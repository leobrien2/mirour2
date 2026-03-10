import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const target = searchParams.get("target");
  const locationParam = searchParams.get("location");

  if (target) {
    return NextResponse.redirect(
      new URL(
        `${target}${locationParam ? `?location=${locationParam}` : ""}`,
        request.url,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/start", request.url));
  }

  try {
    const supabase = await createClient();

    // Check if it's a location entry code
    const { data: location } = await supabase
      .from("locations")
      .select("id")
      .eq("qr_entry_code", code)
      .single();

    if (location) {
      return NextResponse.redirect(
        new URL(`/start?location=${location.id}`, request.url),
      );
    }

    // Can be extended to fetch short codes for specific zones
  } catch (error) {
    console.error("QR code lookup error:", error);
  }

  // Fallback
  return NextResponse.redirect(new URL("/start", request.url));
}
