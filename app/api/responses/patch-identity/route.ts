import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Uses service-role key so it can UPDATE responses regardless of RLS.
// The anon client in the form player only has INSERT on responses,
// so identity-switch patches must go through this server route.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const { responseId, customerId, customerName, customerEmail, customerPhone } =
      await req.json();

    if (!responseId || !customerId) {
      return NextResponse.json(
        { ok: false, error: "missing fields: responseId and customerId are required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("responses")
      .update({
        customer_id: customerId,
        customer_name: customerName ?? null,
        customer_email: customerEmail ?? null,
        customer_phone: customerPhone ?? null,
      })
      .eq("id", responseId);

    if (error) {
      console.error("[patch-identity] supabase error:", error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[patch-identity] error:", err?.message || err);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
