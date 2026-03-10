import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customer_id,
      location_id,
      profile_at_visit,
      skus_shown,
      zones_scanned,
    } = body;

    if (!customer_id)
      return NextResponse.json(
        { error: "customer_id required" },
        { status: 400 },
      );

    const supabase = await createClient();

    // Log the visit
    const { error: visitError } = await supabase
      .from("customer_visits")
      .insert({
        customer_id,
        location_id,
        profile_at_visit,
        skus_shown: skus_shown || [],
        zones_scanned: zones_scanned || [],
      });

    if (visitError) {
      console.error("Visit log error:", visitError);
      return NextResponse.json(
        { error: "Failed to log visit" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
