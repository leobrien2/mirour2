import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmbedding } from "@/lib/embeddings";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { query, store_id, limit = 10 } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    // Embed the raw query directly
    const queryEmbedding = await getEmbedding(query);

    // Fetch a higher limit to ensure we have enough after deduplicating
    const fetchLimit = limit * 3;

    const { data: results, error } = await supabaseAdmin.rpc(
      "search_products_semantic",
      {
        query_embedding: queryEmbedding,
        match_store_id: store_id ?? null,
        match_count: fetchLimit,
        similarity_threshold: 0.3,
      },
    );

    if (error) {
      console.error("[inventory/search] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduplicate results by Name + Description
    const uniqueResults = [];
    const seenKeys = new Set<string>();

    if (results) {
      for (const product of results) {
        // Safely handle strings and null descriptions
        const nameKey = product.name?.toLowerCase().trim() || "";
        const descKey = product.description?.toLowerCase().trim() || "";

        // Combine them with a separator
        const uniqueKey = `${nameKey}-||-${descKey}`;

        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          uniqueResults.push(product);
        }

        // Stop once we reach the originally requested limit
        if (uniqueResults.length >= limit) {
          break;
        }
      }
    }

    return NextResponse.json({
      results: uniqueResults,
      query,
      count: uniqueResults.length,
    });
  } catch (err: any) {
    console.error("[inventory/search]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
