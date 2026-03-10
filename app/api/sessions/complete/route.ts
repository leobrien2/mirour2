import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  try {
    const {
      sessionId,
      responseId,
      customerId,
      totalTimeSec,
      lastNodeId,
      nodeTimeSec,
      enteredAt,
    } = await req.json();

    if (!sessionId || !responseId) {
      return NextResponse.json(
        { ok: false, error: "missing fields" },
        { status: 400 },
      );
    }

    if (lastNodeId && nodeTimeSec != null) {
      await supabase.from("flow_session_nodes").insert({
        session_id: sessionId,
        node_id: lastNodeId,
        time_spent_seconds: nodeTimeSec,
        entered_at: enteredAt || null,
        exited_at: new Date().toISOString(),
        is_dropoff: false,
      });
    }

    const { error } = await supabase
      .from("flow_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        response_id: responseId,
        customer_id: customerId ?? null,
        total_time_seconds:
          typeof totalTimeSec === "number" ? totalTimeSec : null,
      })
      .eq("id", sessionId);

    if (error) {
      console.error("[complete] error:", error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[complete] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
