import { BANNED_PATTERNS, PHONETIC_ANCHORS } from "./phonetic-anchors";
import { safeGenerateContent, modelLite } from "./gemini";
import { getLangfuse } from "./langfuse";
import type Langfuse from "langfuse";

type TraceClient = ReturnType<Langfuse["trace"]>;

/**
 * Minimum phonetic score for a hearsay line to be considered passing.
 * Hearsay is an intentionally approximate, aural art form — the bar is
 * "would an English speaker mishear this Mandarin as this phrase when sung",
 * not strict phoneme-for-phoneme accuracy. Set accordingly.
 */
export const PHONETIC_PASS_THRESHOLD = 0.5;

/**
 * Phonetic judge prompt template. Uses {{anchors_block}} and {{input}} as
 * Langfuse template variables. Kept here as the fallback if Langfuse is
 * unreachable — must stay in sync with the "phonetic-judge" prompt in Langfuse.
 */
export const PHONETIC_JUDGE_TEMPLATE = `You are evaluating "Hearsay Lyrics" for a C-Pop karaoke app.

WHAT HEARSAY LYRICS ARE:
Hearsay lyrics are English phrases chosen to SOUND like Mandarin when sung aloud —
like how a non-Chinese speaker might mishear a song. The goal is aural approximation,
not a translation. Semantic meaning of the English line is IRRELEVANT — a nonsensical
English phrase that sounds like the Mandarin is better than a meaningful one that doesn't.
Slang, contractions, informal speech, and rare-but-real English words are all valid and
do NOT lower the score.

CRITICAL RULE — REAL ENGLISH WORDS ONLY:
Every word must be a genuine English dictionary word or recognised English slang.
Raw romanisation / transliteration of Mandarin is a hard failure even if it sounds accurate,
because the whole point is to find REAL English words that coincidentally approximate the sounds.
Examples of violations: "zai", "shuan", "juan" (used as sounds, not the name), "fangying", "jee", "wha".
If you spot such words, list them in "flaggedWords" AND reduce the score accordingly —
a line with even one non-English word should not score above 0.4.

PHONETIC MAPPING EXAMPLES (what good hearsay looks like for common Mandarin sounds):
{{anchors_block}}

SCORING GUIDE (aural impression when sung, not academic phonetics):
- High  = All words are real English AND most syllables map naturally when sung aloud
- Mid   = All words are real English, some syllables connect clearly, others are loose approximations
- Low   = Real English words but weak phonetic connection; or one borderline non-English word
- Fail  = Non-English / raw pinyin words present, OR no meaningful phonetic relationship

For each entry, return:
- "score": 0.0–1.0 per the guide above
- "reason": one sentence
- "flaggedWords": array of specific words that appear to be non-English or raw pinyin (empty array if none)

Input:
{{input}}

Return ONLY a valid JSON array with one object per entry, preserving the "i" index:
[{"i": 0, "score": 0.87, "reason": "...", "flaggedWords": []}, ...]`;

export interface EvalResult {
  pass: boolean;
  score: number; // 0.0–1.0
  reason: string;
  flaggedWords?: string[]; // words the judge identified as non-English / raw pinyin
  details?: Record<string, unknown>;
}

// Compatible with both fixtures.json (curated) and real HearsayLine output
export interface EvalFixture {
  id?: string;
  chinese: string;
  pinyin: string;
  meaning?: string;
  candidates: { text: string; phonetic?: number; humor?: number }[];
  expectedPass?: boolean;
  notes?: string;
}

export interface EvalCandidateResult {
  text: string;
  bannedCheck: EvalResult;
  phoneticCheck: EvalResult | null; // null = skipped because banned check failed
  pass: boolean;
}

export interface EvalLineResult {
  id?: string;
  chinese: string;
  pinyin: string;
  expectedPass?: boolean;
  notes?: string;
  candidates: EvalCandidateResult[];
  anyPass: boolean; // true if at least one candidate fully passes
  matchesExpected: boolean | null; // null if no expectedPass defined
}

export interface EvalReport {
  source: string;
  totalLines: number;
  totalCandidates: number;
  passingLines: number;
  bannedViolations: number;
  avgPhoneticScore: number;
  expectedMismatches: number; // fixtures where result didn't match expectedPass
  suggestedBannedPatterns: string[]; // novel non-English words flagged by LLM judge, not yet in BANNED_PATTERNS
  results: EvalLineResult[];
}

/**
 * Deterministic check — catches banned pinyin substrings in hearsay text.
 * Free, instant, no API call.
 */
export function checkBannedPatterns(text: string): EvalResult {
  const lower = text.toLowerCase();
  const found = BANNED_PATTERNS.filter((pattern) => {
    // Match pattern as a whole word or substring enclosed by spaces/punctuation
    const regex = new RegExp(`(?<![a-z])${pattern}(?![a-z])`, "i");
    return regex.test(lower);
  });

  if (found.length === 0) {
    return { pass: true, score: 1.0, reason: "no banned patterns found" };
  }

  return {
    pass: false,
    score: 0.0,
    reason: `banned ${found.length === 1 ? "pattern" : "patterns"} found: ${found.map((p) => `'${p}'`).join(", ")}`,
    details: { found },
  };
}

/**
 * LLM-as-judge — scores how well each English hearsay phonetically matches its Mandarin pinyin.
 * Batches all lines into a single Gemini call to minimise API usage and stay well within rate limits.
 * Fetches the judge prompt from Langfuse (versioned); falls back to PHONETIC_JUDGE_TEMPLATE if unreachable.
 */
export async function evaluatePhoneticMatchBatch(
  lines: Array<{ hearsay: string; pinyin: string }>,
  trace?: TraceClient
): Promise<EvalResult[]> {
  if (lines.length === 0) return [];

  const numbered = lines.map((l, i) => ({ i, hearsay: l.hearsay, pinyin: l.pinyin }));

  // Build a compact calibration guide from PHONETIC_ANCHORS so the judge
  // understands the domain's own phonetic vocabulary (e.g. "shuo" → "sure/shore").
  const anchorExamples = Object.entries(PHONETIC_ANCHORS)
    .slice(0, 10)
    .map(([pinyin, words]) => `  "${pinyin}" → ${words.slice(0, 3).join(", ")}`)
    .join("\n");

  // Fetch the versioned judge prompt from Langfuse; fall back to the local template.
  const langfuse = getLangfuse();
  const promptClient = await langfuse.getPrompt("phonetic-judge", undefined, {
    fallback: PHONETIC_JUDGE_TEMPLATE,
    cacheTtlSeconds: 300,
  });
  const prompt = promptClient.compile({
    anchors_block: anchorExamples,
    input: JSON.stringify(numbered, null, 2),
  });

  // Log the Gemini call as a generation span on the parent trace (if provided).
  const generation = trace?.generation({
    name: "phonetic-batch-judge",
    model: modelLite,
    input: prompt,
    promptName: promptClient.name,
    promptVersion: promptClient.version,
  });

  try {
    const result = await safeGenerateContent(modelLite, prompt);
    const text = result.response.text().trim();

    generation?.end({ output: text });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("no JSON array in response");

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ i: number; score: number; reason: string; flaggedWords?: string[] }>;

    // Map back by index; fall back to error result for any missing entries
    return lines.map((_, i) => {
      const entry = parsed.find((r) => r.i === i);
      if (!entry) return { pass: false, score: 0, reason: "eval error: missing from batch response" };
      const score = Math.max(0, Math.min(1, entry.score));
      const flaggedWords = (entry.flaggedWords ?? []).filter(Boolean);
      return { pass: score >= PHONETIC_PASS_THRESHOLD, score, reason: entry.reason ?? "", flaggedWords };
    });
  } catch (err) {
    generation?.end({ output: String(err), level: "ERROR" });
    const reason = `eval error: ${err instanceof Error ? err.message : String(err)}`;
    return lines.map(() => ({ pass: false, score: 0, reason }));
  }
}

/**
 * Run all evaluators over a list of fixtures/HearsayLines.
 * Banned check runs synchronously per candidate.
 * Phonetic eval batches all clean candidates into a single Gemini call.
 * Each run is logged as a Langfuse trace with per-candidate scores.
 */
export async function runEvals(
  fixtures: EvalFixture[],
  source = "unknown"
): Promise<EvalReport> {
  const trace = getLangfuse().trace({
    name: "eval-run",
    input: { source, totalLines: fixtures.length },
  });

  // Step 1: run banned checks synchronously (free, instant)
  type Pending = { fixtureIdx: number; candidateIdx: number; hearsay: string; pinyin: string };
  const bannedResults: EvalResult[][] = fixtures.map((fixture) =>
    fixture.candidates.map((c) => checkBannedPatterns(c.text))
  );

  // Step 2: collect candidates that passed banned check for batch phonetic eval
  const pending: Pending[] = [];
  fixtures.forEach((fixture, fi) => {
    fixture.candidates.forEach((c, ci) => {
      if (bannedResults[fi][ci].pass) {
        pending.push({ fixtureIdx: fi, candidateIdx: ci, hearsay: c.text, pinyin: fixture.pinyin });
      }
    });
  });

  // Step 3: one batch phonetic call for all clean candidates
  const phoneticResults = await evaluatePhoneticMatchBatch(
    pending.map((p) => ({ hearsay: p.hearsay, pinyin: p.pinyin })),
    trace
  );

  // Step 4: assemble results
  const phoneticMap = new Map<string, EvalResult>();
  pending.forEach((p, i) => {
    phoneticMap.set(`${p.fixtureIdx}:${p.candidateIdx}`, phoneticResults[i]);
  });

  let totalCandidates = 0;
  let bannedViolations = 0;
  let phoneticScoreSum = 0;
  let phoneticScoreCount = 0;
  let expectedMismatches = 0;
  const results: EvalLineResult[] = [];
  const allFlaggedWords = new Set<string>();

  for (let fi = 0; fi < fixtures.length; fi++) {
    const fixture = fixtures[fi];
    const candidateResults: EvalCandidateResult[] = [];

    for (let ci = 0; ci < fixture.candidates.length; ci++) {
      totalCandidates++;
      const bannedCheck = bannedResults[fi][ci];
      const phoneticCheck = phoneticMap.get(`${fi}:${ci}`) ?? null;

      if (!bannedCheck.pass) bannedViolations++;
      if (phoneticCheck) {
        phoneticScoreSum += phoneticCheck.score;
        phoneticScoreCount++;
        // Collect novel flagged words not already covered by the deterministic banned list
        phoneticCheck.flaggedWords?.forEach((w) => {
          if (!BANNED_PATTERNS.includes(w.toLowerCase())) allFlaggedWords.add(w.toLowerCase());
        });
      }

      const pass = bannedCheck.pass && (phoneticCheck?.pass ?? false);
      candidateResults.push({ text: fixture.candidates[ci].text, bannedCheck, phoneticCheck, pass });
    }

    const anyPass = candidateResults.some((c) => c.pass);
    let matchesExpected: boolean | null = null;
    if (fixture.expectedPass !== undefined) {
      matchesExpected = anyPass === fixture.expectedPass;
      if (!matchesExpected) expectedMismatches++;
    }

    results.push({
      id: fixture.id,
      chinese: fixture.chinese,
      pinyin: fixture.pinyin,
      expectedPass: fixture.expectedPass,
      notes: fixture.notes,
      candidates: candidateResults,
      anyPass,
      matchesExpected,
    });
  }

  const passingLines = results.filter((r) => r.anyPass).length;
  const avgPhoneticScore = phoneticScoreCount > 0 ? phoneticScoreSum / phoneticScoreCount : 0;

  // Log summary + per-candidate scores to Langfuse.
  trace.update({
    output: { passingLines, totalLines: fixtures.length, bannedViolations, avgPhoneticScore, expectedMismatches },
  });
  trace.score({ name: "pass-rate", value: passingLines / fixtures.length });
  trace.score({ name: "avg-phonetic-score", value: avgPhoneticScore });
  if (expectedMismatches > 0) {
    trace.score({ name: "expected-mismatches", value: expectedMismatches });
  }
  results.forEach((lineResult) => {
    lineResult.candidates.forEach((candidate) => {
      if (candidate.phoneticCheck) {
        trace.score({
          name: "phonetic-score",
          value: candidate.phoneticCheck.score,
          comment: `${lineResult.id ?? lineResult.chinese}: "${candidate.text}"`,
        });
      }
    });
  });

  return {
    source,
    totalLines: fixtures.length,
    totalCandidates,
    passingLines,
    bannedViolations,
    avgPhoneticScore,
    expectedMismatches,
    suggestedBannedPatterns: [...allFlaggedWords].sort(),
    results,
  };
}
