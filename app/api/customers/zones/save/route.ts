import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { customer_id, zone_id } = await request.json();

    if (!customer_id || !zone_id)
      return NextResponse.json({ error: "Missing data" }, { status: 400 });

    const supabase = await createClient();

    const { data: customer } = await supabase
      .from("customers")
      .select("zones_saved")
      .eq("id", customer_id)
      .single();

    const currentZones = customer?.zones_saved || [];
    if (!currentZones.includes(zone_id)) {
      const newZones = [...currentZones, zone_id];
      await supabase
        .from("customers")
        .update({ zones_saved: newZones })
        .eq("id", customer_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
