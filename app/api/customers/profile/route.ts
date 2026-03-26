import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function POST(request: Request) {
  try {
    const { customerId } = await request.json();

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 },
      );
    }

    // 1. Fetch customer basic info
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
console.log(customer)
    if (customerError || !customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    console.log("customer found")

    // 2. Fetch saved items with product details
    let savedItemsQuery = supabase
      .from("saved_items")
      .select(
        `
        id,
        product_id,
        created_at,
        purchased_at,
        products:product_id (
          id,
          name,
          description,
          image_url,
          price,
          in_stock
        )
      `,
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);

      console.log("savedItemsQuery", (await savedItemsQuery).data)

  

    const { data: savedItems } = await savedItemsQuery;

    // 3. Fetch flow sessions
    const { data: flowSessions } = await supabase
      .from("flow_sessions")
      .select(
        `
        id,
        form_id,
        status,
        visited_nodes,
        partial_answers,
        total_time_seconds,
        started_at,
        completed_at,
        drop_off_node_id,
        device_type,
        browser,
        city,
        country
      `,
      )
      .eq("customer_id", customerId)
      .order("started_at", { ascending: false })
      .limit(20);

    // 4. Fetch past responses (quiz answers)
    const { data: responses } = await supabase
      .from("responses")
      .select(
        `
        id,
        form_id,
        answers,
        submitted_at,
        redemption_code,
        perk_redeemed
      `,
      )
      .eq("customer_id", customerId)
      .order("submitted_at", { ascending: false })
      .limit(10);

    // 5. Fetch submission answers (denormalized per-question answers)
    const { data: submissionAnswers } = await supabase
      .from("submission_answers")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);

    // 6. Fetch customer visits
    const { data: customerVisits } = await supabase
      .from("customer_visits")
      .select("*")
      .eq("customer_id", customerId)
      .order("visited_at", { ascending: false })
      .limit(20);

    // 7. Fetch form questions for label resolution
    // Collect unique form_ids from responses + flowSessions
    const formIds = new Set<string>();
    responses?.forEach((r) => {
      if (r.form_id) formIds.add(r.form_id);
    });
    flowSessions?.forEach((s) => {
      if (s.form_id) formIds.add(s.form_id);
    });

    let questionMap: Record<string, string> = {};

    if (formIds.size > 0) {
      const { data: forms } = await supabase
        .from("forms")
        .select("id, questions")
        .in("id", Array.from(formIds));

      if (forms) {
        for (const form of forms) {
          if (Array.isArray(form.questions)) {
            for (const q of form.questions) {
              if (q.id && q.label) {
                questionMap[q.id] = q.label;
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      customer,
      savedItems: savedItems || [],
      flowSessions: flowSessions || [],
      responses: responses || [],
      submissionAnswers: submissionAnswers || [],
      customerVisits: customerVisits || [],
      questionMap,
    });
  } catch (error) {
    console.error("Customer profile API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
