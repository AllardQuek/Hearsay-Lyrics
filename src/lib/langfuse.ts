import Langfuse from "langfuse";

// Module-level singleton — shared across all server-side imports.
let _client: Langfuse | null = null;

export function getLangfuse(): Langfuse {
  if (!_client) {
    _client = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      // Flush events immediately rather than batching — evals are short-lived processes.
      flushAt: 1,
    });
  }
  return _client;
}
