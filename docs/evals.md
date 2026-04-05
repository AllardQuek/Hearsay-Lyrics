# Evaluation Framework for Hearsay Lyrics

This document explains how the evaluation (eval) system validates the quality of generated hearsay lyrics against phonetic accuracy and English language constraints.

## Quick Start

```bash
# Quick local eval (no experiment tracking; good for testing generation quality)
pnpm eval

# Eval last UI-generated output
pnpm eval evals/last-run.json

# Eval custom fixture file
pnpm eval path/to/fixtures.json

# --- Dataset mode: A/B test the judge prompt ---

# One-time setup: import fixtures into Langfuse
pnpm seed-langfuse-dataset

# Baseline: score fixtures with current judge
pnpm eval --dataset judge-baseline

# Edit the phonetic-judge prompt at https://cloud.langfuse.com/prompts
# Bump the version:
pnpm seed-langfuse

# Rerun with new prompt version:
pnpm eval --dataset judge-improved

# Compare results at https://cloud.langfuse.com/datasets/hearsay-fixtures
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
Fixtures (JSON or Langfuse Dataset)
   ↓
   ├─→ checkBannedPatterns()      [instant, deterministic]
   │   ├─→ PASS: proceeds to next check
   │   └─→ FAIL: skips phonetic check
   │
   └─→ evaluatePhoneticMatchBatch() [one Gemini call for all clean candidates]
       ├─→ Fetches versioned "phonetic-judge" prompt from Langfuse
       ├─→ Returns score (0.0–1.0)
       ├─→ Returns reason (short explanation)
       └─→ Returns flaggedWords (novel non-English words found)
       └─→ Logs generation span to Langfuse trace
   ↓
EvalReport + Langfuse Trace
   ├─→ Individual candidate results (pass/fail, scores, reasons)
   ├─→ Summary stats (lines passing, avg score)
   ├─→ Suggested banned pattern additions (flagged words not yet in BANNED_PATTERNS)
   ├─→ Expected match mismatches (fixtures marked wrong)
   └─→ (if --dataset mode) Per-item traces linked to dataset items under a named run
```

### Key Design Decisions

- **Batch phonetic calls:** All clean candidates from a fixture file are scored in a single Gemini call to minimize API usage and respect rate limits.
- **Semantic irrelevance:** The phonetic judge is explicitly told that English line meaning doesn't matter — hearsay is aural art, not translation. "Lose ya shorn in the sway" is better than "lose your lip mark" if it sounds like the Mandarin.
- **Novel word discovery:** Any word the judge flags as non-English/raw-pinyin is collected and displayed at the end under "Suggested additions to BANNED_PATTERNS" — no auto-add, just informational.
- **Langfuse integration:** All eval runs are traced to Langfuse for observability. The `phonetic-judge` prompt is versioned in Langfuse, so you can edit it in the UI and re-run evals to see score deltas. In **dataset mode**, each run is a named experiment that can be compared side-by-side in the Langfuse UI.

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

## Langfuse Integration

### Overview

All eval runs are automatically traced to [Langfuse](https://langfuse.com) for observability and experimentation. The platform provides:

1. **Score history** — watch phonetic scores across all runs
2. **Prompt versioning** — the `phonetic-judge` prompt is managed in Langfuse; edit it in the UI and re-run evals without re-deploying code
3. **Experiment tracking** — use dataset mode to compare judge prompt versions side-by-side (A/B test)

### Understanding the Three Prompts

Your eval system has three prompts, each used at different stages:

| Prompt | Purpose | Managed where | When to change |
|---|---|---|---|
| **`HEARSAY_PROMPT`** | Generates initial hearsay lyrics | `src/lib/gemini.ts` + Langfuse | Testing generation quality (how well does the model create hearsay?) |
| **`DIRECTOR_PROMPT`** | Generates hearsay + visual concepts | `src/lib/gemini.ts` + Langfuse | Testing generation quality (how well does the model add creative descriptions?) |
| **`PHONETIC_JUDGE_TEMPLATE`** | Evaluates how well hearsay sounds like Mandarin | `src/lib/evaluators.ts` + Langfuse | Tuning the evaluator itself (making it stricter, more lenient, or more accurate) |

### Two Test Workflows

#### 1. Tuning the Judge (comparing evaluator versions)

Use this when you want to improve or change **how** your evaluator scores hearsay. Example: "The judge is too lenient; I'll make the instructions stricter."

**Setup (one-time):**
```bash
pnpm seed-langfuse-dataset  # Import fixtures into Langfuse dataset
```

**Baseline:**
```bash
pnpm eval --dataset judge-baseline
```

**Iterate — Two Options:**

**Option A: Edit in Langfuse UI (no code change needed)**
```bash
# Go to https://cloud.langfuse.com/prompts → phonetic-judge → Edit
# Make your changes, save (creates new version in Langfuse)
# In Langfuse UI, click the new version → set label to "production"

pnpm eval --dataset judge-improved    # Fetches the "production" version (your edited one)
```

**Option B: Edit in code and push to Langfuse**
```bash
# Edit PHONETIC_JUDGE_TEMPLATE in src/lib/evaluators.ts
# Push to Langfuse
pnpm seed-langfuse                     # Creates new version from code, labels it "production"

pnpm eval --dataset judge-improved
```

**Compare in Langfuse UI:**
Navigate to Datasets → `hearsay-fixtures` → Runs. You'll see a table with `judge-baseline` vs `judge-improved` scores per fixture. Red highlights = scores dropped, green = improved.

**Important notes:**
- The run name (`judge-baseline`, `judge-improved`) is arbitrary — **you choose it**. Always include context so you remember what changed. Bad: `judge-v1` vs `judge-v2`. Good: `judge-baseline` vs `judge-stricter-no-slang`.
- The **actual prompt version number** is logged in each run's trace. To find it: click the run name → view the trace → check the `phonetic-batch-judge` generation span → prompt version is listed.
- You only need `pnpm seed-langfuse` if you edit the code. If you edit directly in Langfuse UI, just label the new version "production" and you're done.

#### 2. Testing Generation Quality (comparing generator versions)

Use this when you want to improve your **hearsay or director output**. Example: "The generator is picking too many pseudo-English words; I'll improve the prompt."

**Do NOT use dataset mode for this.** Instead:

```bash
# Edit HEARSAY_PROMPT in src/lib/gemini.ts (or in Langfuse UI)
# Re-run the UI to generate new hearsay with your improved prompt
# The UI auto-captures output to evals/last-run.json

pnpm eval evals/last-run.json    # Score it with the stable judge
```

Repeat:
```bash
# Edit HEARSAY_PROMPT again
# Re-run UI
pnpm eval evals/last-run.json
```

**What you're measuring:** "Did my generator produce better hearsay?" The judge (evaluator) stays stable; the generator (creation) changes.

**Why not dataset mode?** Dataset mode is built for comparing the same fixtures under different judges. It's not designed for comparing generated outputs (which change every run). Use local eval mode instead.

### Setup (one-time)

```bash
pnpm seed-langfuse-dataset  # Import all 15 fixtures into a "hearsay-fixtures" dataset
```

This creates a Langfuse dataset with one item per fixture. Re-run this if you add new fixtures to `evals/fixtures.json`.

### Local fixture mode (no experiment tracking)

The existing `pnpm eval` and `pnpm eval path/to/file.json` modes still work unchanged. They log a single batch trace to Langfuse for reference, but no per-item experiment tracking. Use this for quick local iteration or for testing generation quality (workflow #2 above).

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

Evals require:

**Vertex AI credentials:**
```bash
VERTEX_AI_API_KEY=your_vertex_api_key
```

**Langfuse credentials (for tracing + prompt management):**
```bash
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

All set in `.env.local`. The eval script loads this via `--env-file .env.local` (no extra setup needed).

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
- Langfuse client: `src/lib/langfuse.ts`
- CLI script: `scripts/eval.mts`
- Seed prompts to Langfuse: `scripts/seed-langfuse-prompts.mts`
- Seed fixtures to Langfuse dataset: `scripts/seed-langfuse-datasets.mts`
