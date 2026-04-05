/**
 * Hearsay Lyric Eval CLI
 *
 * Usage:
 *   pnpm eval                        # runs evals/fixtures.json
 *   pnpm eval evals/last-run.json    # runs last captured UI output
 *   pnpm eval path/to/any.json       # runs any compatible fixture file
 */

import * as fs from "fs";
import * as path from "path";
import { runEvals, type EvalFixture } from "../src/lib/evaluators";

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

const fixturePath = process.argv[2]
  ?? path.join(process.cwd(), "evals", "fixtures.json");

const resolvedPath = path.resolve(fixturePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(fail(`✗ File not found: ${resolvedPath}`));
  process.exit(1);
}

const fixtures: EvalFixture[] = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
const source = path.relative(process.cwd(), resolvedPath);

console.log(`\n${bold("Hearsay Eval")}  ${dim(source)}`);
console.log(dim(`${fixtures.length} lines · ${fixtures.reduce((n, f) => n + f.candidates.length, 0)} candidates\n`));

const report = await runEvals(fixtures, source);

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

// Exit with non-zero if any expected mismatches (useful for CI)
if (report.expectedMismatches > 0) process.exit(1);
