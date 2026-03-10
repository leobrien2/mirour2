import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client so we can UPDATE any session regardless of RLS
// (the visitor is anonymous and has no auth token at page-close time)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    // sendBeacon sends Content-Type: text/plain but body is valid JSON
    const text = await req.text();
    const { sessionId, dropOffNode, totalTimeSec } = JSON.parse(text);

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ ok: false, error: "missing sessionId" }, { status: 400 });
    }

    // .eq("status", "in_progress") makes this idempotent —
    // calling it twice (e.g. visibilitychange + beforeunload) is safe.
    const { error } = await supabase
      .from("flow_sessions")
      .update({
        status:             "abandoned",
        drop_off_node_id:   dropOffNode ?? null,
        total_time_seconds: typeof totalTimeSec === "number" ? totalTimeSec : null,
        last_activity_at:   new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("status", "in_progress");

    if (error) {
      console.error("[abandon] supabase error:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[abandon] parse error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
