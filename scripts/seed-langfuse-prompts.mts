/**
 * Seeds the three managed prompts into Langfuse.
 * Run once after setting up Langfuse credentials, then re-run whenever
 * you want to push a new version from code (e.g. after editing the templates).
 *
 * Usage:
 *   pnpm tsx --env-file .env.local scripts/seed-langfuse-prompts.mts
 */

import { HEARSAY_PROMPT, DIRECTOR_PROMPT } from "../src/lib/gemini";
import { PHONETIC_JUDGE_TEMPLATE } from "../src/lib/evaluators";
import { getLangfuse } from "../src/lib/langfuse";

const prompts = [
  { name: "hearsay-generation", prompt: HEARSAY_PROMPT },
  { name: "director-generation", prompt: DIRECTOR_PROMPT },
  { name: "phonetic-judge", prompt: PHONETIC_JUDGE_TEMPLATE },
] as const;

const langfuse = getLangfuse();

console.log("\nSeeding prompts to Langfuse...\n");

for (const { name, prompt } of prompts) {
  process.stdout.write(`  Creating "${name}"... `);
  await langfuse.createPrompt({
    name,
    prompt,
    type: "text",
    labels: ["production"],
  });
  console.log("✓");
}

await langfuse.flushAsync();

console.log(`\nDone. View at ${process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com"}/prompts\n`);
