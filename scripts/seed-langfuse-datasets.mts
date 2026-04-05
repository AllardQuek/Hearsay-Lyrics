/**
 * Seeds all fixtures from evals/fixtures.json into a Langfuse dataset named "hearsay-fixtures".
 * Safe to re-run — createDatasetItem updates existing items if the input/output changes.
 *
 * Usage:
 *   pnpm seed-langfuse-dataset
 */

import * as fs from "fs";
import * as path from "path";
import { getLangfuse } from "../src/lib/langfuse";
import type { EvalFixture } from "../src/lib/evaluators";

const DATASET_NAME = "hearsay-fixtures";

const fixturePath = path.join(process.cwd(), "evals", "fixtures.json");
const fixtures: EvalFixture[] = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

const langfuse = getLangfuse();

console.log(`\nSeeding ${fixtures.length} fixtures into Langfuse dataset "${DATASET_NAME}"...\n`);

// Ensure the dataset exists (no-op if already created).
await langfuse.createDataset({
  name: DATASET_NAME,
  description: "Curated hearsay lyric fixtures for phonetic accuracy regression testing.",
});

for (const fixture of fixtures) {
  process.stdout.write(`  ${fixture.id ?? fixture.chinese}... `);

  await langfuse.createDatasetItem({
    datasetName: DATASET_NAME,
    input: {
      chinese: fixture.chinese,
      pinyin: fixture.pinyin,
      candidates: fixture.candidates,
    },
    expectedOutput: {
      pass: fixture.expectedPass,
    },
    metadata: {
      id: fixture.id,
      notes: fixture.notes,
      meaning: fixture.meaning,
    },
  });

  console.log("✓");
}

await langfuse.flushAsync();

console.log(`\nDone. View at ${process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com"}/datasets/${DATASET_NAME}\n`);
