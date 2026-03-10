import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const STORE_ID = "dd506da8-51c8-4f0c-8bfe-988e1e9b4265";
const FORM_ID = "eaa5c406-633c-4b9e-92e0-c3c64ca8a10a"; // Entrance Tanmay

async function seedData() {
  console.log("🚀 Seeding Test Data (Retry with Check-Insert)...");

  // 1. Tags
  console.log("Ensuring Tags...");
  const tags = [
    { name: "Social", is_hard_constraint: false },
    { name: "Calm", is_hard_constraint: false },
    { name: "No-sugar", is_hard_constraint: true },
    { name: "THC-free", is_hard_constraint: true },
  ];

  const tagIds: Record<string, string> = {};

  for (const t of tags) {
    // Check exist
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("store_id", STORE_ID)
      .eq("name", t.name)
      .single();

    if (existing) {
      tagIds[t.name] = existing.id;
    } else {
      // Insert
      const { data: newTag, error } = await supabase
        .from("tags")
        .insert({
          name: t.name,
          store_id: STORE_ID,
          is_hard_constraint: t.is_hard_constraint,
        })
        .select("id")
        .single();

      if (newTag) tagIds[t.name] = newTag.id;
      if (error) console.error(`Tag insert error ${t.name}:`, error.message);
    }
  }
  console.log("✅ Tags ready:", tagIds);

  // 2. Zone
  console.log("Ensuring Zone 'Social Sippers'...");
  let zoneId = "";
  const { data: existingZone } = await supabase
    .from("zones")
    .select("id")
    .eq("store_id", STORE_ID)
    .eq("name", "Social Sippers")
    .single();

  if (existingZone) {
    zoneId = existingZone.id;
    // Update info just in case
    await supabase
      .from("zones")
      .update({
        zone_what: "Non-alcoholic cocktails and craft sodas",
        zone_when: "Parties, dinners, social gatherings",
        zone_who: "Social substituters looking for celebration",
      })
      .eq("id", zoneId);
  } else {
    const { data: newZone, error: zError } = await supabase
      .from("zones")
      .insert({
        name: "Social Sippers",
        store_id: STORE_ID,
        zone_what: "Non-alcoholic cocktails and craft sodas",
        zone_when: "Parties, dinners, social gatherings",
        zone_who: "Social substituters looking for celebration",
      })
      .select("id")
      .single();

    if (newZone) zoneId = newZone.id;
    if (zError) console.error("Zone insert error:", zError.message);
  }
  console.log("✅ Zone ready:", zoneId);

  // 3. Products
  console.log("Ensuring Products...");
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
    let prodId = "";
    const { data: exProd } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", STORE_ID)
      .eq("name", p.name)
      .single();

    if (exProd) {
      prodId = exProd.id;
      // Update props
      await supabase
        .from("products")
        .update({
          description: `Test Product ${p.name}`,
          price: 10,
          image_url: "https://placehold.co/400",
          zone_id: p.zone,
          is_staff_pick: p.staffPick,
        })
        .eq("id", prodId);
    } else {
      const { data: newProd, error: pError } = await supabase
        .from("products")
        .insert({
          name: p.name,
          store_id: STORE_ID,
          description: `Test Product ${p.name}`,
          price: 10,
          image_url: "https://placehold.co/400",
          zone_id: p.zone,
          is_staff_pick: p.staffPick,
        })
        .select("id")
        .single();

      if (newProd) prodId = newProd.id;
      if (pError)
        console.error(`Product insert error ${p.name}:`, pError.message);
    }

    if (prodId) {
      // Link Tags
      await supabase.from("product_tags").delete().eq("product_id", prodId);

      const pTags = p.tags
        .map((tagName) => ({
          product_id: prodId,
          tag_id: tagIds[tagName],
        }))
        .filter((t) => t.tag_id);

      if (pTags.length > 0) {
        const { error: linkError } = await supabase
          .from("product_tags")
          .insert(pTags);
        if (linkError)
          console.error(`Error linking tags for ${p.name}:`, linkError.message);
      }
    }
  }
  console.log("✅ Products ready");

  if (Object.keys(tagIds).length < 4 || !zoneId) {
    console.error("❌ Failed to resolve IDs. Aborting Form Update.");
    return;
  }

  // 4. Update Form Questions
  console.log("Updating Form Questions...");
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
      text: "What is the occasion?",
      questionType: "single_select",
      options: [
        { label: "Social gathering", value: "social", nextId: "q2" },
        { label: "Other", value: "other", nextId: "q2" },
      ],
      conditionalNext: [
        {
          optionValue: "social",
          nextNodeId: "q2",
          addTags: [tagIds["Social"]],
        },
      ],
    },
    {
      id: "q2",
      type: "question",
      text: "How do you want to feel?",
      questionType: "single_select",
      options: [
        { label: "Relaxed and calm", value: "calm", nextId: "q3" },
        { label: "Energetic", value: "energy", nextId: "q3" },
      ],
      conditionalNext: [
        { optionValue: "calm", nextNodeId: "q3", addTags: [tagIds["Calm"]] },
      ],
    },
    {
      id: "q3",
      type: "question",
      text: "Dietary preferences?",
      questionType: "multi_select",
      options: [
        { label: "No sugar", value: "nosugar" },
        { label: "THC / Cannabis", value: "thc" }, // wait, this question adds Hard Tags?
      ],
      conditionalNext: [
        // Multi select logic usually handles array?
        // Our logic maps options to tags.
        { optionValue: "nosugar", addTags: [tagIds["No-sugar"]] },
        { optionValue: "thc", addTags: [tagIds["THC-free"]] },
      ],
      nextId: "rec",
    },
    {
      id: "rec",
      type: "recommendation", // or whatever the type is
      recommendationLogic: {
        matchStrategy: "all", // Match All hard/soft?
        limit: 3,
      },
    },
  ];

  const { error: formError } = await supabase
    .from("forms")
    .update({ questions: questions })
    .eq("id", FORM_ID);

  if (formError) console.error("❌ Form update error:", formError);
  else console.log("✅ Form updated with Test Questions");

  console.log(`\n🎉 Data Seeding Complete!`);
  console.log(`Test URL: http://localhost:3000/f/${FORM_ID}?zone_id=${zoneId}`);
}

seedData();
