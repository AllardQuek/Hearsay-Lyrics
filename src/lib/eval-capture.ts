import * as fs from "fs";
import * as path from "path";
import type { EvalFixture } from "./evaluators";

/**
 * Normalises either DirectorLine or HearsayLine arrays into EvalFixture format
 * and writes them to evals/last-run.json as a fire-and-forget side-effect.
 *
 * DirectorLine shape: { chinese, pinyin, meaning, hearsay: string, ... }
 * HearsayLine shape:  { chinese, pinyin, meaning, candidates: [...] }
 *
 * Strips imageBase64 / imageMimeType so the file stays lightweight.
 */
function toEvalFixtures(lines: unknown[]): EvalFixture[] {
  return lines.flatMap((line) => {
    const l = line as Record<string, unknown>;
    const chinese = String(l.chinese ?? "");
    const pinyin = String(l.pinyin ?? "");
    const meaning = l.meaning ? String(l.meaning) : undefined;

    if (!chinese || !pinyin) return [];

    // DirectorLine: single hearsay string
    if (typeof l.hearsay === "string" && l.hearsay) {
      return [{ chinese, pinyin, meaning, candidates: [{ text: l.hearsay }] }];
    }

    // HearsayLine: candidates array
    if (Array.isArray(l.candidates) && l.candidates.length > 0) {
      const candidates = l.candidates.map((c: unknown) => {
        const cand = c as Record<string, unknown>;
        return {
          text: String(cand.text ?? ""),
          ...(typeof cand.phonetic === "number" ? { phonetic: cand.phonetic } : {}),
          ...(typeof cand.humor === "number" ? { humor: cand.humor } : {}),
        };
      }).filter((c) => c.text);
      if (candidates.length > 0) return [{ chinese, pinyin, meaning, candidates }];
    }

    return [];
  });
}

export function captureLastRun(lines: unknown[]): void {
  try {
    const fixtures = toEvalFixtures(lines);
    console.log("[eval-capture] captureLastRun called, fixtures:", fixtures.length);
    if (fixtures.length === 0) return;
    const evalsDir = path.join(process.cwd(), "evals");
    console.log("[eval-capture] writing to", path.join(evalsDir, "last-run.json"));
    fs.mkdirSync(evalsDir, { recursive: true });
    fs.writeFile(
      path.join(evalsDir, "last-run.json"),
      JSON.stringify(fixtures, null, 2),
      (err) => { if (err) console.error("[eval-capture] Failed to write last-run.json:", err); else console.log("[eval-capture] last-run.json written"); }
    );
  } catch (err) {
    console.error("[eval-capture] captureLastRun error:", err);
  }
}
