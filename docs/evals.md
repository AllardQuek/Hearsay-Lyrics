# Evaluation Framework for Hearsay Lyrics

This document explains how the evaluation (eval) system validates the quality of generated hearsay lyrics against phonetic accuracy and English language constraints.

## Quick Start

```bash
# Run evaluations against curated test fixtures
pnpm eval

# Run evaluations against last captured UI output
pnpm eval evals/last-run.json

# Run evaluations against a custom fixture file
pnpm eval path/to/fixtures.json
```

## What Are Evals?

The eval system automatically scores hearsay lyrics on two dimensions:

1. **Banned Pattern Check** (deterministic, free)
   - Catches known pinyin substrings and pseudo-English sounds that shouldn't appear in output
   - Examples: `"shuo"`, `"tiao"`, `"zway"`, `"jui"` — these are pinyin sounds, not English words
   - Runs instantly, no API call

2. **Phonetic Match Score** (LLM-as-judge, via Gemini)
   - Evaluates how naturally each English hearsay captures the Mandarin sound when sung aloud
   - Returns a 0.0–1.0 score plus explanatory reason
   - Passes/fails based on `PHONETIC_PASS_THRESHOLD = 0.5` (semantic slop is intentional in hearsay)
   - Also flags novel non-English words that the judge discovers

## How Evals Work

### Architecture

```
Fixtures (JSON)
   ↓
   ├─→ checkBannedPatterns()      [instant, deterministic]
   │   ├─→ PASS: proceeds to next check
   │   └─→ FAIL: skips phonetic check
   │
   └─→ evaluatePhoneticMatchBatch() [one Gemini call for all clean candidates]
       ├─→ Returns score (0.0–1.0)
       ├─→ Returns reason (short explanation)
       └─→ Returns flaggedWords (novel non-English words found)

   ↓
EvalReport
   ├─→ Individual candidate results (pass/fail, scores, reasons)
   ├─→ Summary stats (lines passing, avg score)
   ├─→ Suggested banned pattern additions (flagged words not yet in BANNED_PATTERNS)
   └─→ Expected match mismatches (fixtures marked wrong)
```

### Key Design Decisions

- **Batch phonetic calls:** All clean candidates from a fixture file are scored in a single Gemini call to minimize API usage and respect rate limits.
- **Semantic irrelevance:** The phonetic judge is explicitly told that English line meaning doesn't matter — hearsay is aural art, not translation. "Lose ya shorn in the sway" is better than "lose your lip mark" if it sounds like the Mandarin.
- **Novel word discovery:** Any word the judge flags as non-English/raw-pinyin is collected and displayed at the end under "Suggested additions to BANNED_PATTERNS" — no auto-add, just informational.

## Fixture Format

Fixtures are JSON files containing test cases. Two main sources exist:

### `evals/fixtures.json` (Curated, Committed)
Hand-authored fixture file with known-good examples, known-bad examples, and edge cases. Committed to the repo for regression testing.

```json
[
  {
    "id": "lc-v4-sai-na-he-pan",
    "chinese": "塞纳河畔",
    "pinyin": "Sāi nà hé pàn",
    "meaning": "By the Seine",
    "candidates": [
      { "text": "Sinner her pan" }
    ],
    "expectedPass": true,
    "notes": "Good phonetic mapping: 'Sinner' ~ Sāi nà, 'her' ~ hé, 'pan' ~ pàn"
  },
  {
    "id": "banned-shuo-nan",
    "chinese": "你说你有点难追",
    "pinyin": "Nǐ shuō nǐ yǒudiǎn nán zhuī",
    "candidates": [
      { "text": "Nee shuo nee yo then nan jury" }
    ],
    "expectedPass": false,
    "notes": "Contains banned patterns: 'shuo' and 'nan'"
  }
]
```

**Fields:**
- `id`: unique identifier for the test case
- `chinese`: original Mandarin lyric
- `pinyin`: romanization with tone marks
- `meaning`: English translation (informational)
- `candidates`: array of hearsay variants to evaluate
- `expectedPass`: boolean; if set, eval will track whether the actual result matches this expectation
- `notes`: context about why this case was chosen

### `evals/last-run.json` (Auto-captured, Gitignored)
Automatically written by `/api/generate` when the UI generates lyrics. Captures the final output (post-review) as a fixture file for re-evaluation. Useful for debugging past runs.

## Running Evals

### Command Line

```bash
# Default: run curated fixtures
pnpm eval
```

Output:
```
Hearsay Eval  evals/fixtures.json
15 lines · 16 candidates

塞纳河畔 [lc-v4-sai-na-he-pan]
  banned   ✅ 1.00  no banned patterns found
  phonetic ✅ 0.80  Very strong phonetic alignment, particularly with 'Sinner' and 'her'...
  → PASS  "Sinner her pan"

你说你有点难追 [lc-v4-banned-shuo-nan]
  banned   ❌ 0.00  banned patterns found: 'shuo', 'nan'
  phonetic ⏭  skipped (banned check failed)
  → FAIL  "Nee shuo nee yo then nan jury"

[... more results ...]

Summary
  4/15 lines passing (27%)
  banned violations:   7
  avg phonetic score:  0.61
  3 fixture(s) didn't match expectedPass

Suggested additions to BANNED_PATTERNS
  These words were flagged as non-English / raw pinyin by the LLM judge.
  Review and add to src/lib/phonetic-anchors.ts if correct.

  → 'zai'
  → 'shuan'
  → 'juan'
```

### Interpreting Results

**Per-candidate output:**
- `banned` row: deterministic check result (`✅` pass, `❌` fail)
- `phonetic` row: LLM judge score (`✅` ≥0.5, `❌` <0.5), reason, and any flagged words
- `→ PASS/FAIL`: overall result (both banned and phonetic must pass)

**Summary stats:**
- `X/Y lines passing`: lines where at least one candidate passed all checks
- `banned violations`: count of candidates that failed the banned check
- `avg phonetic score`: average score across all candidates that passed the banned check
- `N fixture(s) didn't match expectedPass`: fixtures where actual result differed from expected

**Suggested additions:**
- Words flagged by the LLM judge that aren't yet in `BANNED_PATTERNS`
- Review manually before adding to ensure no false positives (e.g., `"go"` is valid English but also a Mandarin sound)

### Exit Codes

- `0`: all tests passed (or no expected mismatches)
- `1`: at least one fixture did not match its `expectedPass` expectation (useful for CI)

## Updating BANNED_PATTERNS

When eval runs suggest new words to ban:

1. Review the suggestions carefully (check context, notes)
2. If confident, add to `src/lib/phonetic-anchors.ts`:

```ts
export const BANNED_PATTERNS = [
  "shuo", "tiao", "nan", "jee", "zai", "shuan", "juan", // ... add new ones
];
```

3. Re-run evals to confirm the new patterns are caught deterministically:

```bash
pnpm eval
```

## Adding New Test Cases

Edit `evals/fixtures.json` and add a new object:

```json
{
  "id": "my-test-case",
  "chinese": "你好世界",
  "pinyin": "Nǐ hǎo shì jiè",
  "candidates": [
    { "text": "Knee how sure gay" }
  ],
  "expectedPass": true,
  "notes": "Testing edge case X"
}
```

Then run:

```bash
pnpm eval
```

## Auto-capture from UI

When you use the UI (`/api/generate`), the final output is automatically saved to `evals/last-run.json`. You can then run:

```bash
pnpm eval evals/last-run.json
```

This is useful for:
- Debugging a specific UI session
- Evaluating new songs not yet in the curated fixture set
- Regression testing after prompt changes

## Integration with CI/CD

In the future, add to your CI/CD pipeline:

```bash
pnpm eval
```

This will exit with code 1 if any `expectedPass` fixtures don't match, causing the CI run to fail.

## Environment Variables

Evals require Vertex AI credentials (same as the app):

```bash
VERTEX_AI_API_KEY=your_vertex_api_key
```

Set in `.env.local`. The eval script loads this via `--env-file .env.local` (no extra setup needed).

## Performance Notes

- **Banned check:** instant (microseconds per candidate)
- **Phonetic batch call:** ~2–5 seconds for 10–20 candidates (one Gemini call)
- **Total run:** typically 10–20 seconds including all fixtures

If you have 100+ fixtures, consider splitting into multiple fixture files and running separately.

## Troubleshooting

**"File not found"**
```
✗ File not found: /path/to/fixtures.json
```
Check the path argument. Use absolute paths or relative to the repo root.

**"No JSON array in response"**
This indicates the Gemini call failed or returned unparseable JSON. Check `.env.local` and Vertex AI quota.

**"missing from batch response"**
One or more candidates weren't scored in the batch. This suggests a bug in the batch index mapping. File an issue with the fixture content.

## Useful Docs

- Gemini config & prompts: `src/lib/gemini.ts`
- Phonetic anchors & banned patterns: `src/lib/phonetic-anchors.ts`
- Evaluator logic: `src/lib/evaluators.ts`
- CLI script: `scripts/eval.mts`
