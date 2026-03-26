import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";

async function fetchProducts(
  formId: string,
  tagIds: string[],
  strategy: "any" | "all",
  limit: number,
) {
  const supabase = await createClient();

  // Resolve owner_id from formId
  const { data: form, error: formError } = await (supabase as any)
    .from("forms")
    .select("owner_id")
    .eq("id", formId)
    .eq("active", true)
    .single();

  if (formError || !form?.owner_id) return [];

  if (strategy === "any") {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, name, price, image_url,description, tags!inner(id, name)")
      .eq("owner_id", form.owner_id)
      .in("tags.id", tagIds)
      .limit(limit);

    return error ? [] : (data ?? []);
  }

  if (strategy === "all") {
    const { data, error } = await (supabase as any)
      .from("products")
      .select("id, name, price,description, image_url, tags!inner(id, name)")
      .eq("owner_id", form.owner_id)
      .in("tags.id", tagIds)
      .limit(limit * 5);

    if (error) return [];

    return (data ?? [])
      .filter((p: any) => {
        const productTagIds: string[] = (p.tags ?? []).map((t: any) => t.id);
        return tagIds.every((tid) => productTagIds.includes(tid));
      })
      .slice(0, limit);
  }

  return [];
}

// GET /api/products/by-tags?formId=...&tagIds=a,b&strategy=any&limit=12
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const formId   = searchParams.get("formId");
  const tagIds   = searchParams.get("tagIds")?.split(",").filter(Boolean) ?? [];
  const strategy = (searchParams.get("strategy") ?? "any") as "any" | "all";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "12"), 50);

  if (!formId || tagIds.length === 0) return Response.json({ products: [] });

  const products = await fetchProducts(formId, tagIds, strategy, limit);
  return Response.json({ products });
}

// POST /api/products/by-tags  { formId, tagIds: string[], strategy, limit }
export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}));
  const formId   = body.formId as string | undefined;
  const tagIds   = (body.tagIds as string[] | undefined)?.filter(Boolean) ?? [];
  const strategy = (body.strategy ?? "any") as "any" | "all";
  const limit    = Math.min(parseInt(String(body.limit ?? 12)), 50);

  if (!formId || tagIds.length === 0) return Response.json({ products: [] });

  const products = await fetchProducts(formId, tagIds, strategy, limit);
  return Response.json({ products });
}
