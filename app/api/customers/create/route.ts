import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatPhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/(?!^\+)[^\d]/g, "");
  return cleaned || null; // ← return null if result is still empty
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const formattedPhone = formatPhone(body.phone); // now null, not ''

    console.log("API CALL: create customer - formatted phone", formattedPhone);

    // Check for duplicate by phone or email
    let existing = null;

    if (formattedPhone) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", formattedPhone)
        .eq("store_id", body.store_id)
        .single();
      existing = data;
    }

    if (!existing && body.email) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("email", body.email)
        .eq("store_id", body.store_id)
        .single();
      existing = data;
    }

    if (existing) {
      // Update last_active and merge name if missing
      const { data: updated } = await supabase
        .from("customers")
        .update({
          last_active: new Date().toISOString(),
          name: existing.name || body.name || null,
          // backfill email/phone if they were missing before
          email: existing.email || body.email || null,
          phone: existing.phone || formattedPhone || null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      return NextResponse.json({
        success: true,
        token: existing.id,
        profile: updated ?? existing,
        isExisting: true,
      });
    }

    const { tags, ...restBody } = body;

    const { data: result, error } = await supabase
      .from("customers")
      .insert([
        {
          ...restBody,
          traits: tags ? { tags } : {},
          phone: formattedPhone, // ← null, not '' or body.phone
          email: body.email || null, // ← null if empty
          last_active: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Customer save error:", error);

      // Race condition fallback — concurrent insert won the race
      if (error.code === "23505") {
        // Look up the winner and return it as success
        let raceExisting = null;

        if (formattedPhone) {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .eq("phone", formattedPhone)
            .eq("store_id", body.store_id)
            .single();
          raceExisting = data;
        }

        if (!raceExisting && body.email) {
          const { data } = await supabase
            .from("customers")
            .select("*")
            .eq("email", body.email)
            .eq("store_id", body.store_id)
            .single();
          raceExisting = data;
        }

        if (raceExisting) {
          await supabase
            .from("customers")
            .update({ last_active: new Date().toISOString() })
            .eq("id", raceExisting.id);

          return NextResponse.json({
            success: true,
            token: raceExisting.id,
            profile: raceExisting,
            isExisting: true,
          });
        }
      }

      return NextResponse.json(
        { success: false, error: "Save failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      token: result.id,
      profile: result,
    });
  } catch (error) {
    console.error("API CALL: create customer - error", error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
