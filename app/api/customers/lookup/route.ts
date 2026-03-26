import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { phone, token, email } = await request.json();
    const supabase = await createClient();

    console.log("phone", phone);
    console.log("token", token);
    console.log("email", email);

    if (token) {
      // Lookup by token (customer ID)
      const { data: customer, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", token)
        .single();

      if (error || !customer) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        success: true,
        profile: customer,
        token: customer.id,
      });
    }

    if (email) {
      // Lookup by email (Checks primary email OR secondary_emails array)
      const normalizedEmail = email.trim().toLowerCase();
      console.log("normalizedEmail", normalizedEmail);

      const { data: customers, error } = await supabase
        .from("customers")
        .select("*")
        // Use Supabase OR syntax to check the array. 'cs' means "contains"
        .or(
          `email.eq.${normalizedEmail},secondary_emails.cs.{"${normalizedEmail}"}`,
        )
        .limit(1);

      const customer = customers?.[0];
      console.log("customer", customer);

      if (error || !customer) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        success: true,
        profile: customer,
        token: customer.id,
      });
    }

    if (phone) {
      // Search for various phone formats
      const digits = phone.replace(/\D/g, "");
      const phoneVariations = new Set([phone, phone.trim()]);

      if (digits.length === 10) {
        phoneVariations.add(digits);
        phoneVariations.add(`1${digits}`);
        phoneVariations.add(`+1${digits}`);
        phoneVariations.add(
          `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`,
        );
        phoneVariations.add(
          `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
        );
      } else if (digits.length === 11 && digits.startsWith("1")) {
        const local = digits.slice(1);
        phoneVariations.add(digits);
        phoneVariations.add(`+${digits}`);
        phoneVariations.add(local);
        phoneVariations.add(
          `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`,
        );
        phoneVariations.add(
          `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`,
        );
      } else if (digits.length > 0) {
        phoneVariations.add(digits);
        phoneVariations.add(`+${digits}`);
      }

      // Lookup by phone variations
      const { data: customers, error } = await supabase
        .from("customers")
        .select("*")
        .in("phone", Array.from(phoneVariations))
        .limit(1); // Added limit(1) for safety/performance

      const customer = customers?.[0];
      console.log("customer", customer);

      if (error || !customer) {
        return NextResponse.json(
          { error: "Profile not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        profile: customer,
        token: customer.id,
      });
    }

    return NextResponse.json(
      { error: "Provide phone, email or token" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
