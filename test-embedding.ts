// scripts/test-embedding.ts
// import { getEmbedding, buildProductEmbeddingText } from "../lib/embeddings";

import { buildProductEmbeddingText, getEmbedding } from "./lib/embeddings";

async function test() {
  const text = buildProductEmbeddingText({
    name: "Chamomile Dreams Tea",
    description: "A calming herbal tea designed to help with sleep",
    tags: ["caffeine-free", "sleep", "herbal", "calming"],
  });

  console.log("Embedding text:\n", text);

  const embedding = await getEmbedding(text);

  console.log("\nEmbedding dims:", embedding.length); // should be 1536
  console.log("First 5 values:", embedding.slice(0, 5)); // should be floats
  console.log("\n✅ embeddings.ts is working correctly");
}

test().catch(console.error);
