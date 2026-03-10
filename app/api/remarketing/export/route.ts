import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/remarketing/export
 *
 * Query params:
 *   store_id  — required
 *   segment   — optional: all_opted_in | vip | lapsed | saves_without_purchase | completed_flow
 *   format    — optional: json (default) | csv
 *
 * Returns the remarketing contact list for the store, filtered by segment.
 * Only the authenticated store owner can access their own store's data.
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
  const storeId = searchParams.get("store_id");
  const segment = searchParams.get("segment") || "all_opted_in";
  const format  = searchParams.get("format") || "json";

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

  // ── Query the remarketing_contacts view ───────────────────────────────────

  let query = supabaseAdmin
    .from("remarketing_contacts" as any)
    .select("*")
    .eq("store_id", storeId);

  // Apply segment filters
  switch (segment) {
    case "vip":
      query = query.eq("is_vip", true);
      break;
    case "lapsed":
      // Use separate lapsed_visitors view for richer data
      {
        const { data: lapsed, error: lapsedErr } = await supabaseAdmin
          .from("lapsed_visitors" as any)
          .select("*")
          .eq("store_id", storeId);

        if (lapsedErr) {
          return NextResponse.json({ error: lapsedErr.message }, { status: 500 });
        }
        return buildResponse(lapsed ?? [], format, segment);
      }

    case "saves_without_purchase":
      {
        const { data: saves, error: savesErr } = await supabaseAdmin
          .from("saves_without_purchase" as any)
          .select("*")
          .eq("store_id", storeId);

        if (savesErr) {
          return NextResponse.json({ error: savesErr.message }, { status: 500 });
        }
        return buildResponse(saves ?? [], format, segment);
      }

    case "completed_flow":
      query = query.eq("completed_flow", true);
      break;

    case "all_opted_in":
    default:
      // No extra filter — returns all contacts with phone or email
      break;
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return buildResponse(data ?? [], format, segment);
}

// ── Response formatter ────────────────────────────────────────────────────────

function buildResponse(rows: any[], format: string, segment: string) {
  if (format === "csv") {
    if (rows.length === 0) {
      return new NextResponse("", {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="remarketing_${segment}.csv"`,
        },
      });
    }

    const headers = Object.keys(rows[0]).join(",");
    const csvRows = rows.map((r) =>
      Object.values(r)
        .map((v) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v ?? ""))
        .join(","),
    );
    const csv = [headers, ...csvRows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="remarketing_${segment}.csv"`,
      },
    });
  }

  return NextResponse.json({
    segment,
    count: rows.length,
    data:  rows,
  });
}
