// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { formId } = await req.json();
    if (!formId) throw new Error("Missing formId");

    // Fetch form to get questions
    const { data: form } = await supabaseClient
      .from("forms")
      .select("questions")
      .eq("id", formId)
      .single();

    if (!form) throw new Error("Form not found");

    // Fetch all responses
    const { data: responses, error: responseError } = await supabaseClient
      .from("responses")
      .select("*")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });

    if (responseError) throw responseError;

    // Build headers
    const customQuestions = form.questions
      .filter((q: any) => q.type === "question" || q.type === "rating")
      .map((q: any) => ({ id: q.id, label: q.label || q.id }));

    let csvContent =
      "Submitted At,Customer Name,Customer Email,Customer Phone,Perk Redeemed";
    for (const q of customQuestions) {
      // Escape quotes
      const cleanLabel = String(q.label).replace(/"/g, '""');
      csvContent += `,"${cleanLabel}"`;
    }
    csvContent += "\n";

    // Build Rows
    for (const res of responses || []) {
      const row = [
        res.submitted_at ? new Date(res.submitted_at).toISOString() : "",
        res.customer_name || "",
        res.customer_email || "",
        res.customer_phone || "",
        res.perk_redeemed ? "Yes" : "No",
      ];

      let rowString = row
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");

      for (const q of customQuestions) {
        const val = res.answers && res.answers[q.id] ? res.answers[q.id] : "";
        const valString = Array.isArray(val) ? val.join("; ") : String(val);
        rowString += `,"${valString.replace(/"/g, '""')}"`;
      }

      csvContent += rowString + "\n";
    }

    return new Response(csvContent, {
      headers: { ...corsHeaders, "Content-Type": "text/csv" },
      status: 200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
