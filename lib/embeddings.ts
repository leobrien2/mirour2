// lib/embeddings.ts

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

// ── Single embedding ──────────────────────────────────────────────────────────

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${error}`);
  }

  const json = await res.json();
  return json.data[0].embedding as number[];
}

// ── Batch embeddings (for backfill) ──────────────────────────────────────────
// OpenAI supports up to 2048 inputs per request
// We batch in groups of 20 to stay safe

export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Embedding batch API error ${res.status}: ${error}`);
  }

  const json = await res.json();

  // OpenAI returns results sorted by index — preserve original order
  return json.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((item: any) => item.embedding as number[]);
}

// ── Build product embedding text ──────────────────────────────────────────────
// Call this to build the text that gets embedded for a product.
// Used in both the generate route and the backfill route.

export function buildProductEmbeddingText(product: {
  name: string;
  description?: string | null;
  tags?: string[];
}): string {
  const parts = [
    `Name: ${product.name}`,
    product.description ? `Description: ${product.description}` : null,
    product.tags?.length ? `Tags: ${product.tags.join(", ")}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}
