// app/api/embeddings/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmbedding, buildProductEmbeddingText } from "@/lib/embeddings";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { product_id } = await req.json();

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 },
      );
    }

    // Fetch product + its tags in one query
    const { data: product, error: fetchError } = await supabaseAdmin
      .from("products")
      .select(
        `
        id,
        name,
        description,
        product_tags (
          tags ( name )
        )
      `,
      )
      .eq("id", product_id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Extract tag names from the join
    const tagNames = (product.product_tags as any[])
      ?.map((pt) => pt.tags?.name)
      .filter(Boolean) as string[];

    // Build the text to embed
    const embeddingText = buildProductEmbeddingText({
      name: product.name,
      description: product.description,
      tags: tagNames,
    });

    // Generate embedding
    const embedding = await getEmbedding(embeddingText);

    // Store back into products table
    const { error: updateError } = await supabaseAdmin
      .from("products")
      .update({
        embedding: JSON.stringify(embedding),
        embedding_text: embeddingText,
        embedding_updated_at: new Date().toISOString(),
      })
      .eq("id", product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      product_id,
      dims: embedding.length,
    });
  } catch (err: any) {
    console.error("[embeddings/generate]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
