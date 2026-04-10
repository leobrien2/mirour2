// app/api/admin/embeddings/backfill/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getEmbeddingsBatch,
  buildProductEmbeddingText,
} from "@/lib/embeddings";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { owner_id } = await req.json();

    if (!owner_id) {
      return NextResponse.json(
        { error: "owner_id is required" },
        { status: 400 },
      );
    }

    // Fetch all active, non-deleted, un-embedded products for this owner
    // Guard: skip any rows where name is null (corrupt data)
    const { data: products, error: fetchError } = await supabaseAdmin
      .from("products")
      .select(
        `
        id, name, description,
        product_tags ( tags ( name ) )
      `,
      )
      .eq("owner_id", owner_id)
      .eq("active", true)
      .is("deleted_at", null)
      .is("embedding", null)
      .not("name", "is", null); // guard against corrupt rows

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        message: "All products already embedded",
        processed: 0,
      });
    }

    console.log(
      `[backfill] ${products.length} products to embed for owner ${owner_id}`,
    );

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      // Build embedding texts for the batch
      const texts = batch.map((p) => {
        const tagNames = (p.product_tags as any[])
          ?.map((pt) => pt.tags?.name)
          .filter(Boolean) as string[];

        return buildProductEmbeddingText({
          name: p.name,
          description: p.description,
          tags: tagNames,
        });
      });

      try {
        // Single OpenAI call for the whole batch
        const embeddings = await getEmbeddingsBatch(texts);

        // UPDATE (not upsert) — products already exist, we only patch embedding columns.
        // upsert would attempt INSERT first and fail NOT NULL on name/store_id/etc.
        const updateResults = await Promise.all(
          batch.map(
            (p, idx) =>
              supabaseAdmin
                .from("products")
                .update({
                  embedding: JSON.stringify(embeddings[idx]),
                  embedding_text: texts[idx],
                  embedding_updated_at: new Date().toISOString(),
                })
                .eq("id", p.id)
                .eq("owner_id", owner_id), // tenant safety
          ),
        );

        const batchErrors = updateResults
          .map((r, idx) =>
            r.error ? { id: batch[idx].id, msg: r.error.message } : null,
          )
          .filter(Boolean);

        if (batchErrors.length > 0) {
          console.error(
            `[backfill] batch ${batchNum} — ${batchErrors.length} update(s) failed:`,
            batchErrors,
          );
          failed += batchErrors.length;
          processed += batch.length - batchErrors.length;
        } else {
          processed += batch.length;
          console.log(
            `[backfill] ✅ batch ${batchNum} done (${processed}/${products.length})`,
          );
        }
      } catch (batchErr: any) {
        console.error(
          `[backfill] batch ${batchNum} failed (embedding API):`,
          batchErr.message,
        );
        failed += batch.length;
      }

      // Respect OpenAI rate limits between batches
      if (i + BATCH_SIZE < products.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(
      `[backfill] complete — processed: ${processed}, failed: ${failed}, total: ${products.length}`,
    );

    return NextResponse.json({
      success: true,
      total: products.length,
      processed,
      failed,
    });
  } catch (err: any) {
    console.error("[backfill] unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
