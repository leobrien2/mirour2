// lib/rewriteQuery.ts
import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

export async function rewriteQueryForSearch(
  query: string,
  storeContext?: string, // optional: e.g. "beverage store", "clothing store"
): Promise<string> {
  try {
    const res = await mistral.chat.complete({
      model: "mistral-small-2506", // small is plenty for rewrites — fast + cheap
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a product search assistant${storeContext ? ` for a ${storeContext}` : ""}.
Rewrite the user's natural language query into a clean, keyword-rich search phrase
that will match product names, descriptions, and tags in a product catalog.

Rules:
- Fix typos and spelling mistakes
- Expand vague intent into concrete product keywords
- Remove filler words ("i want", "something", "a bit", "like")
- Handle negations: "not too sweet" → "low sugar mild subtle"
- Handle occasion/mood: "for sleep" → "sleep aid calming chamomile melatonin relaxing"
- Handle gift context: "gift for mom who likes floral" → "floral rose jasmine gift feminine"
- Return ONLY the rewritten keywords, nothing else
- Max 15 words
- No punctuation, no quotes`,
        },
        {
          role: "user",
          content: query,
        },
      ],
    });

    const rewritten = (res.choices?.[0]?.message?.content as string)?.trim();
    return rewritten || query; // fallback to original if anything goes wrong
  } catch (err) {
    console.warn("[rewriteQuery] Mistral rewrite failed, using original:", err);
    return query; // never break search if rewrite fails
  }
}
