import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatPhone(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/(?!^\+)[^\d]/g, "");
  return cleaned || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const formattedPhone = formatPhone(body.phone);
    const incomingEmail = body.email ? body.email.trim().toLowerCase() : null;

    console.log(
      "API CALL: create customer - formatted phone:",
      formattedPhone,
      "email:",
      incomingEmail,
    );

    // ==========================================
    // HELPER 1: Two-Pass Lookup Logic
    // ==========================================
    async function findCustomer() {
      // Pass 1: Try Phone
      if (formattedPhone) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("phone", formattedPhone)
          .limit(1); // Use limit(1) instead of single() to prevent crashes on edge-case duplicates

        if (data && data.length > 0) return data[0];
      }

      // Pass 2: Try Email (check primary OR secondary array)
      if (incomingEmail) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .or(
            `email.eq.${incomingEmail},secondary_emails.cs.{"${incomingEmail}"}`,
          )
          .limit(1);

        if (data && data.length > 0) return data[0];
      }

      return null;
    }

    // ==========================================
    // HELPER 2: Safe Merge Logic
    // ==========================================
    async function mergeAndUpdate(existing: any) {
      const currentEmail = existing.email
        ? existing.email.trim().toLowerCase()
        : null;

      const updatePayload: any = {
        last_active: new Date().toISOString(),
        name: existing.name || body.name || null,
        // Keep their current email if they have one, otherwise set the incoming one
        email: currentEmail || incomingEmail,
        // Backfill phone if it was missing
        phone: existing.phone || formattedPhone || null,
      };

      // Handle Secondary Emails Append
      if (incomingEmail && currentEmail && incomingEmail !== currentEmail) {
        // Use Set to prevent duplicates in the array
        const pastEmails = new Set(existing.secondary_emails || []);
        pastEmails.add(incomingEmail);
        updatePayload.secondary_emails = Array.from(pastEmails);
      }

      // Handle Tags Append (Merge with existing traits.tags)
      if (body.tags && Array.isArray(body.tags)) {
        let updatedTraits = { ...(existing.traits || {}) };
        const existingTags = new Set(updatedTraits.tags || []);
        body.tags.forEach((tag: string) => existingTags.add(tag));
        updatedTraits.tags = Array.from(existingTags);
        updatePayload.traits = updatedTraits;
      }

      const { data: updated } = await supabase
        .from("customers")
        .update(updatePayload)
        .eq("id", existing.id)
        .select()
        .single();

      return updated ?? existing;
    }

    // ==========================================
    // EXECUTION FLOW
    // ==========================================

    // 1. Initial Lookup
    let existing = await findCustomer();

    // 2. If Exists -> Merge & Return
    if (existing) {
      const updatedProfile = await mergeAndUpdate(existing);
      return NextResponse.json({
        success: true,
        token: existing.id,
        profile: updatedProfile,
        isExisting: true,
      });
    }

    // 3. If Brand New -> Insert
    const insertPayload = {
      name: body.name || null,
      first_name: body.first_name || body.firstName || null, // Handle both standard and camelCase
      last_name: body.last_name || body.lastName || null,
      phone: formattedPhone,
      email: incomingEmail,
      store_id: body.store_id || null,
      traits: body.tags ? { tags: body.tags } : {},
      last_active: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from("customers")
      .insert([insertPayload])
      .select()
      .single();

    // 4. Handle Insert Errors / Race Conditions
    if (error) {
      console.error("Customer save error:", error);

      // Race condition (23505): Another simultaneous request created the customer fractions of a second ago
      if (error.code === "23505") {
        const raceExisting = await findCustomer();

        if (raceExisting) {
          // Gracefully merge data into the newly created profile
          const updatedProfile = await mergeAndUpdate(raceExisting);
          return NextResponse.json({
            success: true,
            token: raceExisting.id,
            profile: updatedProfile,
            isExisting: true,
          });
        }
      }

      return NextResponse.json(
        { success: false, error: "Save failed" },
        { status: 500 },
      );
    }

    // 5. Success on Brand New Profile
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
