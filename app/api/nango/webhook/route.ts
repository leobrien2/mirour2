import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use Service Role key because this endpoint is triggered by public form submissions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    // We expect formId and customerData from the frontend
    const body = await request.json();
    const { formId, customerData } = body;

    console.log("Webhook Trigger - Form ID:", formId);
    console.log("Webhook Trigger - Customer Data:", customerData);

    if (!formId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: formId" },
        { status: 400 },
      );
    }

    if (!customerData || Object.keys(customerData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing customerData payload" },
        { status: 400 },
      );
    }

    // 1. Get the owner_id from the FORM the customer just filled out
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("owner_id")
      .eq("id", formId)
      .single();

    if (formError || !form || !form.owner_id) {
      return NextResponse.json(
        { success: false, error: "Form or Owner not found" },
        { status: 404 },
      );
    }

    console.log("Form Owner ID:", form.owner_id);

    // 2. Get the Webhook Integration URL using the form's owner_id
    const { data: integration, error: integrationError } = await supabase
      .from("store_integrations")
      .select("api_key")
      .eq("owner_id", form.owner_id)
      .eq("platform", "webhook")
      .single();

    if (integrationError || !integration?.api_key) {
      // Not an error, the admin just hasn't connected a Webhook yet
      return NextResponse.json({
        success: true,
        message: "No Webhook integration found for this account. Skipped.",
      });
    }

    const webhookUrl = integration.api_key;
    console.log("Triggering Webhook URL:", webhookUrl);

    // 3. Build the payload dynamically to match your Zapier format
    const payload: Record<string, any> = {};

    if (customerData.firstName !== undefined)
      payload.firstName = customerData.firstName;
    if (customerData.lastName !== undefined)
      payload.lastName = customerData.lastName;

    // Handle Contact mapping
    if (customerData.Contact !== undefined) {
      payload.Contact = customerData.Contact;
    } else if (
      customerData.email !== undefined ||
      customerData.phone !== undefined ||
      customerData.mobile !== undefined
    ) {
      payload.Contact = {};
      if (customerData.email !== undefined)
        payload.Contact.email = customerData.email;
      // Accept either phone or mobile from frontend, map to 'mobile' for Zapier
      if (customerData.mobile !== undefined)
        payload.Contact.mobile = customerData.mobile;
      else if (customerData.phone !== undefined)
        payload.Contact.mobile = customerData.phone;
    }

    // Pass through any other extra fields the customer filled out
    for (const key in customerData) {
      if (
        ![
          "firstName",
          "lastName",
          "email",
          "phone",
          "mobile",
          "Contact",
        ].includes(key)
      ) {
        payload[key] = customerData[key];
      }
    }

    console.log("Final Webhook Payload:", payload);

    // 4. Fire the POST request to the external Webhook (Zapier, Make, etc.)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 5. Handle failure from the external webhook
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Webhook failed with status ${response.status}: ${errorText}`,
      );
    }

    // Zapier usually returns a success object like { attempt: "...", id: "...", request_id: "...", status: "success" }
    const result = await response.json().catch(() => ({ status: "ok" }));

    return NextResponse.json({
      success: true,
      message: "Webhook triggered successfully.",
      data: result,
    });
  } catch (error: any) {
    console.error("[WEBHOOK_TRIGGER_ERROR]:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "An unexpected error occurred while triggering the webhook.",
      },
      { status: 500 },
    );
  }
}
