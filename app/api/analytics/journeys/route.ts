import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/analytics/journeys
 *
 * Returns cross-location visitor journey data for a store.
 * Groups by visitor_id — shows same person visiting multiple touchpoints.
 *
 * Query params:
 *   store_id    — required
 *   visitor_id  — optional: filter to a single visitor
 *   limit       — optional: default 50
 *
 * Auth: store owner JWT in Authorization header.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  // ── Auth: verify the caller owns the store ─────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const storeId   = searchParams.get("store_id");
  const visitorId = searchParams.get("visitor_id");
  const limit     = parseInt(searchParams.get("limit") || "50", 10);

  if (!storeId) {
    return NextResponse.json({ error: "store_id is required" }, { status: 400 });
  }

  // Verify ownership
  const { data: store, error: storeErr } = await supabaseAdmin
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .single();

  if (storeErr || !store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  if (store.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Single visitor: use the get_visitor_sessions RPC ─────────────────────
  if (visitorId) {
    const { data, error } = await supabaseAdmin.rpc("get_visitor_sessions", {
      p_store_id:   storeId,
      p_visitor_id: visitorId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ visitor_id: visitorId, sessions: data });
  }

  // ── All cross-location visitors for this store ────────────────────────────
  const { data, error } = await (supabaseAdmin as any)
    .from("cross_location_visitors")
    .select("*")
    .eq("store_id", storeId)  // Note: view may not expose store_id directly
    .limit(limit);

  // Fallback: join via visitor_location_journeys if view doesn't filter by store
  if (error || !data?.length) {
    const { data: journeys, error: jErr } = await (supabaseAdmin as any)
      .from("visitor_location_journeys")
      .select("visitor_id, customer_id, store_id, session_id, visited_at")
      .eq("store_id", storeId)
      .order("visited_at", { ascending: false })
      .limit(limit * 5); // fetch more rows to group

    if (jErr) {
      return NextResponse.json({ error: jErr.message }, { status: 500 });
    }

    // Group by visitor_id in JS (simple aggregation)
    const grouped: Record<string, any> = {};
    for (const j of (journeys ?? []) as any[]) {
      if (!grouped[j.visitor_id]) {
        grouped[j.visitor_id] = {
          visitor_id:  j.visitor_id,
          customer_id: j.customer_id,
          stores:      new Set<string>(),
          journey:     [],
        };
      }
      grouped[j.visitor_id].stores.add(j.store_id);
      grouped[j.visitor_id].journey.push({
        store_id:   j.store_id,
        visited_at: j.visited_at,
        session_id: j.session_id,
      });
    }

    const result = Object.values(grouped)
      .map((v: any) => ({ ...v, stores_visited: v.stores.size, stores: undefined }))
      .filter((v: any) => v.stores_visited > 0)
      .slice(0, limit);

    return NextResponse.json({ store_id: storeId, count: result.length, data: result });
  }

  return NextResponse.json({ store_id: storeId, count: data.length, data });
}
