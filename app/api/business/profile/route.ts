import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force Node.js runtime instead of Edge to fix Next.js API build issues with Edge
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Bypass Next.js static caching

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get("formId");
    const locationId = searchParams.get("locationId");

    console.log("formId", formId);
    console.log("locationId", locationId);

    if (!formId && !locationId) {
      return NextResponse.json(
        { error: "Provide formId or locationId" },
        { status: 400 },
      );
    }

    // Initialize supabase with SERVICE ROLE KEY to bypass RLS securely on the server
    const supabaseOptions = {
      auth: { persistSession: false },
    };
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      supabaseOptions,
    );

    let storeId = null;
    let ownerId = null;
    let diagnostics: any = {};

    if (formId) {
      console.log("formId", formId);
      const { data: formData, error: formError } = await supabase
        .from("forms")
        .select("owner_id, show_start_page")
        .eq("id", formId)
        .single();

      console.log("formData", formData);
      console.log("formError", formError);

      if (formError) {
        console.error("formError:", formError);
        diagnostics.formError = formError;
      }

      if (formData) {
        if (formData.owner_id) ownerId = formData.owner_id;
        if (formData.show_start_page !== undefined)
          diagnostics.showStartPage = formData.show_start_page;
      }
    } else if (locationId) {
      console.log("locationId", locationId);
      const { data: locationData, error: locationError } = await supabase
        .from("locations")
        .select("store_id, owner_id") // Changed to also select owner_id
        .eq("id", locationId)
        .single();

      console.log("locationData", locationData);
      console.log("locationError", locationError);

      if (locationError) {
        console.error("locationError:", locationError);
        diagnostics.locationError = locationError;
      }

      if (locationData?.store_id) storeId = locationData.store_id;
      if (locationData?.owner_id) ownerId = locationData.owner_id; // Assign ownerId if found
    }

    // if forms didn't have owner_id, but had store_id, try to get owner_id from stores
    if (!ownerId && storeId) {
      console.log("storeId", storeId);
      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("user_id")
        .eq("id", storeId)
        .single();

      console.log("storeData", storeData);
      console.log("storeError", storeError);

      if (storeError) {
        console.error("storeError:", storeError);
        diagnostics.storeError = storeError;
      }

      if (storeData?.user_id) {
        ownerId = storeData.user_id;

        console.log("ownerId", ownerId);
      }
    }

    if (!ownerId) {
      return NextResponse.json(
        {
          error: `No owner linked for form ${formId} location ${locationId} store ${storeId}`,
          diagnostics,
        },
        { status: 404 },
      );
    }

    console.log("ownerId", ownerId);

    const { data: profileData, error: profileError } = await supabase
      .from("admin_users")
      .select("business_name, business_logo")
      .eq("id", ownerId)
      .single();

    console.log("profileData", profileData);
    console.log("profileError", profileError);

    if (profileError) {
      console.error("profileError:", profileError);
      diagnostics.profileError = profileError;
    }

    if (!profileData) {
      return NextResponse.json(
        { error: `Profile not found for owner ${ownerId}`, diagnostics },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      profile: profileData,
      show_start_page: diagnostics.showStartPage ?? true,
    });
  } catch (error: any) {
    console.error("API error fetching business profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
