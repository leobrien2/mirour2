import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const TEST_EMAIL = `sprint3test_${Date.now()}@gmail.com`;
const TEST_PASSWORD = "Password123!";

async function setupTestUser() {
  console.log(`🚀 Setting up Test User: ${TEST_EMAIL}`);

  // 1. Sign Up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error("❌ Signup failed:", authError.message);
    process.exit(1);
  }

  const user = authData.user;
  if (!user) {
    console.error("❌ User not created (maybe email confirm needed?)");
    // Check if session exists (auto confirm might be on for dev)
    if (authData.session) {
      console.log("✅ Auto-confirmed.");
    } else {
      console.log(
        "⚠️ Confirmation email sent. Cannot proceed without confirmation.",
      );
      // In local dev, email checking is tricky.
      // But if Supabase is local/dev, usually auto-confirm is on.
      process.exit(1);
    }
  }

  const token = authData.session?.access_token;
  if (!token) {
    console.error("❌ No access token. Exiting.");
    process.exit(1);
  }

  console.log("✅ User authenticated.");

  // Create Authenticated Client
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  // 2. Create Store (if not exists)
  // Check if store exists for this user (owner_id)
  // But wait, owner_id is checked via RLS.
  console.log("Check/Create Store...");
  let storeId = "";

  const { data: stores } = await authClient.from("stores").select("id");
  if (stores && stores.length > 0) {
    storeId = stores[0].id;
    console.log("✅ Found existing store:", storeId);
  } else {
    const { data: newStore, error: storeError } = await authClient
      .from("stores")
      .insert({
        name: "Sprint 3 Test Store",
        // owner_id is auto-set by RLS/Trigger usually? Or must be sent?
        // If RLS allows insert, it usually sets owner_id to auth.uid() via default or trigger.
        // Or we explicitly set it if allowed.
        owner_id: user!.id,
      })
      .select("id")
      .single();

    if (storeError) {
      console.error("❌ Store creation failed:", storeError.message);
      // Try without owner_id if implicit
      const { data: retryStore, error: retryError } = await authClient
        .from("stores")
        .insert({
          name: "Sprint 3 Test Store",
        })
        .select("id")
        .single();

      if (retryError) {
        console.error("❌ Store creation retry failed:", retryError.message);
        process.exit(1);
      }
      if (retryStore) storeId = retryStore.id;
    } else if (newStore) {
      storeId = newStore.id;
    }
  }
  console.log("✅ Store ID:", storeId);

  // 3. Seed Data (Tags, Zones, Products)
  // Use authClient for everything

  // Tags
  const tagIds: Record<string, string> = {};
  const tags = [
    { name: "Social", is_hard_constraint: false },
    { name: "Calm", is_hard_constraint: false },
    { name: "No-sugar", is_hard_constraint: true },
    { name: "THC-free", is_hard_constraint: true },
  ];

  for (const t of tags) {
    const { data: newTag, error: tagError } = await authClient
      .from("tags")
      .insert({
        name: t.name,
        store_id: storeId,
        is_hard_constraint: t.is_hard_constraint,
      })
      .select("id")
      .single();

    if (tagError) console.error(`Tag ${t.name} error:`, tagError.message);
    if (newTag) tagIds[t.name] = newTag.id;
  }
  console.log("✅ Tags created:", tagIds);

  // Zone
  const { data: zone, error: zoneError } = await authClient
    .from("zones")
    .insert({
      name: "Social Sippers",
      store_id: storeId,
      zone_what: "Non-alcoholic cocktails",
      zone_when: "Parties",
      zone_who: "Celebrate",
    })
    .select("id")
    .single();

  if (zoneError) console.error("Zone error:", zoneError.message);
  const zoneId = zone?.id;
  console.log("✅ Zone created:", zoneId);

  // Products
  const products = [
    {
      name: "Ghia Spritz",
      tags: ["Social", "No-sugar", "THC-free"],
      zone: zoneId,
      staffPick: false,
    },
    { name: "Sugary Soda", tags: ["Social"], zone: zoneId, staffPick: false },
    {
      name: "Calm Tea",
      tags: ["Calm", "No-sugar", "THC-free"],
      zone: zoneId,
      staffPick: false,
    },
  ];

  for (const p of products) {
    const { data: prod, error: pError } = await authClient
      .from("products")
      .insert({
        name: p.name,
        store_id: storeId,
        description: `Test Product ${p.name}`,
        price: 10,
        image_url: "https://placehold.co/400",
        zone_id: p.zone,
        is_staff_pick: p.staffPick,
      })
      .select("id")
      .single();

    if (prod) {
      const pTags = p.tags
        .map((t) => ({ product_id: prod.id, tag_id: tagIds[t] }))
        .filter((x) => x.tag_id);
      if (pTags.length) await authClient.from("product_tags").insert(pTags);
    }
  }
  console.log("✅ Products created");

  // 4. Create Form
  const questions = [
    {
      id: "welcome",
      type: "welcome",
      content: "Welcome to {{zone_name}}",
      contentType: "text",
      buttonText: "Start",
    },
    {
      id: "q1",
      type: "question",
      text: "Occasion?",
      questionType: "single_select",
      options: [
        { label: "Social", value: "social", nextId: "q2" },
        { label: "Work", value: "work", nextId: "q2" },
      ],
      conditionalNext: [
        {
          optionValue: "social",
          nextNodeId: "q2",
          addTags: [tagIds["Social"]],
        }, // Corrected access
      ],
    },
    {
      id: "q2",
      type: "question",
      text: "Feel?",
      questionType: "single_select",
      options: [{ label: "Calm", value: "calm", nextId: "q3" }],
      conditionalNext: [
        { optionValue: "calm", nextNodeId: "q3", addTags: [tagIds["Calm"]] },
      ],
    },
    {
      id: "q3",
      type: "question",
      text: "Diet?",
      questionType: "multi_select",
      options: [
        { label: "No Sugar", value: "nosugar" },
        { label: "THC Free", value: "thc" },
      ],
      conditionalNext: [
        { optionValue: "nosugar", addTags: [tagIds["No-sugar"]] },
        { optionValue: "thc", addTags: [tagIds["THC-free"]] },
      ],
      nextId: "rec",
    },
    {
      id: "rec",
      type: "recommendation",
      recommendationLogic: { matchStrategy: "all", limit: 3 },
    },
  ];

  const { data: form, error: formError } = await authClient
    .from("forms")
    .insert({
      name: "Sprint 3 Validated Flow",
      store_id: storeId,
      owner_id: user!.id,
      questions: questions,
      active: true,
    })
    .select("id")
    .single();

  if (formError) console.error("Form error:", formError.message);
  else {
    console.log(`\n🎉 SETUP COMPLETE!`);
    console.log(`Store ID: ${storeId}`);
    console.log(`Form ID: ${form.id}`);
    console.log(`Zone ID: ${zoneId}`);
    console.log(
      `TEST URL: http://localhost:3000/f/${form.id}?zone_id=${zoneId}`,
    );
    console.log(`ACCESS_TOKEN: ${token}`);
  }
}

setupTestUser();
