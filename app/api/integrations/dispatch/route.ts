import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role is needed to look up the form owner securely
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { formId, customerData } = body;

    if (!formId || !customerData) {
      return NextResponse.json(
        { success: false, error: "Missing payload" },
        { status: 400 },
      );
    }

    // 1. Find the owner of this form
    const { data: form } = await supabase
      .from("forms")
      .select("owner_id")
      .eq("id", formId)
      .single();

    if (!form || !form.owner_id) {
      return NextResponse.json(
        { success: false, error: "Form not found" },
        { status: 404 },
      );
    }

    // 2. Fetch all active integrations for this owner
    const { data: integrations } = await supabase
      .from("store_integrations")
      .select("platform")
      .eq("owner_id", form.owner_id);

    const activePlatforms = integrations?.map((i) => i.platform) || [];

    // If no integrations are active, just return success immediately
    if (activePlatforms.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No integrations to run.",
      });
    }

    // 3. Get the base URL of your application so we can make internal API calls
    const host = request.headers.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const dispatchPromises: Promise<any>[] = [];

    console.log("[Dispatcher] Active Platforms:", activePlatforms);
    console.log("[Dispatcher] Customer Data:", customerData);

    // 4. Route to Shopify (only if they have Shopify AND provided an email)
    if (activePlatforms.includes("shopify") && customerData.email) {
      console.log("[Dispatcher] Routing to Shopify");
      dispatchPromises.push(
        fetch(`${baseUrl}/api/nango/shopify/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    }

    // 5. Route to Webhook (if they have it connected)
    if (activePlatforms.includes("webhook")) {
      console.log("[Dispatcher] Routing to Webhook");
      dispatchPromises.push(
        fetch(`${baseUrl}/api/nango/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    }

    // 6. Execute all required integrations in parallel
    // We use Promise.allSettled so if one fails (e.g., Shopify), the other (e.g., Webhook) still finishes.
    await Promise.allSettled(dispatchPromises);

    return NextResponse.json({
      success: true,
      message: "Data dispatched to active integrations.",
      dispatchedTo: activePlatforms,
    });
  } catch (error: any) {
    console.error("[DISPATCHER_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to dispatch integrations" },
      { status: 500 },
    );
  }
}
