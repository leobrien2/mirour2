import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Nango } from "@nangohq/node";

const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Formats phone to E.164 standard, defaulting to US (+1)
function formatPhoneForShopify(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If it doesn't already start with a '+'
  if (!cleaned.startsWith('+')) {
    // Check if the user typed 11 digits starting with a '1' (e.g., 12125551234)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = `+${cleaned}`;
    } else {
      // Otherwise, assume it's a standard 10-digit US number and prepend +1
      cleaned = `+1${cleaned}`; 
    }
  }
  
  return cleaned;
}

export async function POST(request: Request) {
  try {
    // We now expect formId from the frontend
    const { formId, customerData } = await request.json();

    console.log("Customer Data:", customerData);
    console.log("Form ID:", formId);

    if (!customerData.email || !formId) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields",
      });
    }

    // 1. Get the owner_id from the FORM the customer just filled out
    const { data: form } = await supabase
      .from("forms")
      .select("owner_id")
      .eq("id", formId)
      .single();

    if (!form || !form.owner_id) {
      return NextResponse.json({
        success: false,
        error: "Form or Owner not found",
      });
    }

    console.log("Form Owner ID:", form.owner_id);

    // 2. Get the Shopify Nango Connection ID using the form's owner_id
    const { data: integration } = await supabase
      .from("store_integrations")
      .select("api_key")
      .eq("owner_id", form.owner_id)
      .eq("platform", "shopify")
      .single();

      console.log("Integration:", integration);

    if (!integration) {
      // Not an error, the admin just hasn't connected Shopify yet
      return NextResponse.json({
        success: true,
        message: "No Shopify integration found for this account. Skipped.",
      });
    }

    const connectionId = integration.api_key;

    // 3. SEARCH SHOPIFY FOR DUPLICATES
const searchRes = await nango.get({
  endpoint: "/admin/api/2024-01/customers.json",
  params: { email: customerData.email },
  providerConfigKey: "shopify",
  connectionId: connectionId,
});

    // console.log("Search Response:", searchRes);

    const existingCustomers = searchRes.data?.customers || [];

    console.log("Existing Customers:", existingCustomers);

    if (existingCustomers.length > 0) {
      // 4a. CUSTOMER EXISTS -> Update them
      const shopifyCustomerId = existingCustomers[0].id;


      const formattedPhone = formatPhoneForShopify(customerData.phone);
      console.log("Formatted Phone:", formattedPhone);

      const body = {
        customer: {
          id: shopifyCustomerId,
          first_name: customerData.firstName || existingCustomers[0].first_name,
          last_name: customerData.lastName || existingCustomers[0].last_name,
          phone:
            formatPhoneForShopify(customerData.phone) ||
            existingCustomers[0].phone,
          tags: "Mirour_Lead",
          email_marketing_consent: {
            state: "subscribed",
            opt_in_level: "single_opt_in",
            consent_updated_at: new Date().toISOString(),
          },
        },
      };
        
console.log("Body:", body);
      await nango.put({
        endpoint: `/admin/api/2024-01/customers/${shopifyCustomerId}.json`,
        providerConfigKey: "shopify",
        connectionId: connectionId,
        data: body
      });

      return NextResponse.json({
        success: true,
        action: "updated",
        shopifyId: shopifyCustomerId,
      });
    } else {

        const body = {
          customer: {
            first_name: customerData.firstName || "",
            last_name: customerData.lastName || "",
            email: customerData.email,
            phone: formatPhoneForShopify(customerData.phone) || null,
            tags: "Mirour_Lead",
            email_marketing_consent: {
              state: "subscribed",
              opt_in_level: "single_opt_in",
              consent_updated_at: new Date().toISOString(),
            },
          },
        };

        console.log("Body:", body);
      // 4b. CUSTOMER DOES NOT EXIST -> Create them
      const createRes = await nango.post({
        endpoint: "/admin/api/2024-01/customers.json",
        providerConfigKey: "shopify",
        connectionId: connectionId,
        data: body
      });

      return NextResponse.json({
        success: true,
        action: "created",
        shopifyId: createRes.data.customer.id,
      });
    }
  } catch (error: any) {
    console.log("Error:", error);
    console.error("Shopify Sync Error:", error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: "Failed to sync to Shopify" },
      { status: 500 },
    );
  }
}
