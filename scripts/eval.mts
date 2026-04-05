/**
 * Hearsay Lyric Eval CLI
 *
 * Usage:
 *   pnpm eval                            # runs evals/fixtures.json
 *   pnpm eval evals/last-run.json        # runs last captured UI output
 *   pnpm eval path/to/any.json           # runs any compatible fixture file
 *   pnpm eval --dataset <run-name>       # runs Langfuse "hearsay-fixtures" dataset, records a named run
 */

import * as fs from "fs";
import * as path from "path";
import { runEvals, type EvalFixture } from "../src/lib/evaluators";
import { getLangfuse } from "../src/lib/langfuse";

// ANSI colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
};

function pass(s: string) { return `${c.green}${s}${c.reset}`; }
function fail(s: string) { return `${c.red}${s}${c.reset}`; }
function dim(s: string) { return `${c.dim}${s}${c.reset}`; }
function bold(s: string) { return `${c.bold}${s}${c.reset}`; }
function cyan(s: string) { return `${c.cyan}${s}${c.reset}`; }

// --- Resolve fixtures and source label ---

const isDatasetMode = process.argv[2] === "--dataset";
const datasetRunName = isDatasetMode ? process.argv[3] : undefined;

if (isDatasetMode && !datasetRunName) {
  console.error(fail("✗ Missing run name. Usage: pnpm eval --dataset <run-name>"));
  process.exit(1);
}

let fixtures: EvalFixture[];
let source: string;

// Dataset items kept in scope for linking after eval (dataset mode only).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let datasetItems: any[] | null = null;

if (isDatasetMode) {
  const dataset = await getLangfuse().getDataset("hearsay-fixtures");
  datasetItems = dataset.items;
  fixtures = dataset.items.map((item) => ({
    id: item.metadata?.id as string | undefined,
    chinese: (item.input as Record<string, unknown>).chinese as string,
    pinyin: (item.input as Record<string, unknown>).pinyin as string,
    candidates: (item.input as Record<string, unknown>).candidates as EvalFixture["candidates"],
    expectedPass: (item.expectedOutput as Record<string, unknown> | null)?.pass as boolean | undefined,
    notes: item.metadata?.notes as string | undefined,
    meaning: item.metadata?.meaning as string | undefined,
  }));
  source = `langfuse:hearsay-fixtures`;
} else {
  const fixturePath = process.argv[2]
    ?? path.join(process.cwd(), "evals", "fixtures.json");
  const resolvedPath = path.resolve(fixturePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(fail(`✗ File not found: ${resolvedPath}`));
    process.exit(1);
  }
  fixtures = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  source = path.relative(process.cwd(), resolvedPath);
}

// --- Run ---

const modeLabel = isDatasetMode
  ? `${bold("Hearsay Eval")}  ${dim(`langfuse:hearsay-fixtures`)}  ${dim(`run: ${datasetRunName}`)}`
  : `${bold("Hearsay Eval")}  ${dim(source)}`;

console.log(`\n${modeLabel}`);
console.log(dim(`${fixtures.length} lines · ${fixtures.reduce((n, f) => n + f.candidates.length, 0)} candidates\n`));

const report = await runEvals(fixtures, source);

// --- Print results ---

for (const line of report.results) {
  const label = line.id ? dim(`[${line.id}]`) : "";
  const chinese = cyan(line.chinese);
  console.log(`${chinese} ${label}`);

  for (const c of line.candidates) {
    const textStr = `"${c.text}"`;

    // Banned check row
    const bannedIcon = c.bannedCheck.pass ? pass("✅") : fail("❌");
    const bannedScore = c.bannedCheck.score.toFixed(2);
    console.log(`  banned   ${bannedIcon} ${bannedScore}  ${dim(c.bannedCheck.reason)}`);

    // Phonetic check row
    if (c.phoneticCheck === null) {
      console.log(`  phonetic ${dim("⏭  skipped (banned check failed)")}`);
    } else {
      const phoneticIcon = c.phoneticCheck.pass ? pass("✅") : fail("❌");
      const phoneticScore = c.phoneticCheck.score.toFixed(2);
      const flagged = c.phoneticCheck.flaggedWords?.length
        ? `  ${fail("flagged:")} ${c.phoneticCheck.flaggedWords.map((w) => `'${w}'`).join(", ")}`
        : "";
      console.log(`  phonetic ${phoneticIcon} ${phoneticScore}  ${dim(c.phoneticCheck.reason)}${flagged}`);
    }

    const resultIcon = c.pass ? pass("PASS") : fail("FAIL");
    console.log(`  → ${resultIcon}  ${textStr}`);
  }

  // Expected vs actual
  if (line.matchesExpected === false) {
    const expected = line.expectedPass ? "pass" : "fail";
    const actual = line.anyPass ? "pass" : "fail";
    console.log(`  ${fail("⚠")} expected=${expected} got=${actual}${line.notes ? `  ${dim(line.notes)}` : ""}`);
  }

  console.log();
}

// Summary
const pct = Math.round((report.passingLines / report.totalLines) * 100);
const summaryColor = pct === 100 ? pass : pct >= 70 ? (s: string) => `\x1b[33m${s}\x1b[0m` : fail;

console.log(bold("Summary"));
console.log(`  ${summaryColor(`${report.passingLines}/${report.totalLines} lines passing`)} (${pct}%)`);
console.log(`  banned violations:   ${report.bannedViolations > 0 ? fail(String(report.bannedViolations)) : pass("0")}`);
console.log(`  avg phonetic score:  ${report.avgPhoneticScore.toFixed(2)}`);
if (report.expectedMismatches > 0) {
  console.log(`  ${fail(`${report.expectedMismatches} fixture(s) didn't match expectedPass`)}`);
}
console.log();

// Suggested banned pattern additions
if (report.suggestedBannedPatterns.length > 0) {
  console.log(bold("Suggested additions to BANNED_PATTERNS"));
  console.log(dim("  These words were flagged as non-English / raw pinyin by the LLM judge."));
  console.log(dim("  Review and add to src/lib/phonetic-anchors.ts if correct.\n"));
  report.suggestedBannedPatterns.forEach((w) => console.log(`  ${fail("→")} '${w}'`));
  console.log();
}

// --- Dataset run linking (dataset mode only) ---
// Create a thin per-item trace for each fixture, log its scores, and link to the dataset item.
// This is what Langfuse uses to build the experiment comparison table across runs.
if (isDatasetMode && datasetItems && datasetRunName) {
  process.stdout.write(dim(`Linking ${report.results.length} items to dataset run "${datasetRunName}"... `));

  const langfuse = getLangfuse();
  await Promise.all(
    datasetItems.map(async (datasetItem) => {
      const itemId = datasetItem.metadata?.id as string | undefined;
      const lineResult = report.results.find((r) => r.id === itemId);
      if (!lineResult) return;

      // Thin result trace — captures what happened for this fixture in this run.
      const trace = langfuse.trace({
        name: "dataset-eval-item",
        input: {
          chinese: lineResult.chinese,
          pinyin: lineResult.pinyin,
          candidates: lineResult.candidates.map((c) => c.text),
        },
        output: {
          anyPass: lineResult.anyPass,
          candidates: lineResult.candidates.map((c) => ({
            text: c.text,
            pass: c.pass,
            bannedPass: c.bannedCheck.pass,
            phoneticScore: c.phoneticCheck?.score ?? null,
            reason: c.phoneticCheck?.reason ?? null,
          })),
        },
        metadata: { runName: datasetRunName },
      });

      // Log per-candidate scores so the Langfuse UI can display them per item.
      for (const candidate of lineResult.candidates) {
        if (candidate.phoneticCheck) {
          trace.score({ name: "phonetic-score", value: candidate.phoneticCheck.score });
        }
        trace.score({ name: "pass", value: candidate.pass ? 1 : 0 });
      }

      await datasetItem.link(trace, datasetRunName);
    })
  );

  console.log(pass("done"));
  console.log(dim(`  View run at ${process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com"}/datasets/hearsay-fixtures/runs/${datasetRunName}\n`));
}

// Flush all Langfuse events before the process exits (short-lived Node process won't auto-flush).
await getLangfuse().flushAsync();

// Exit with non-zero if any expected mismatches (useful for CI)
if (report.expectedMismatches > 0) process.exit(1);
