import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function listForms() {
  console.log("🔍 Listing Public Forms (Schema Debug)...");

  // Try selecting * to see available columns
  const { data: forms, error } = await supabase
    .from("public_forms")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Error fetching public_forms:", error);
  } else if (forms && forms.length > 0) {
    console.log("✅ public_forms columns:", Object.keys(forms[0]));
    console.log("Sample:", forms[0]);
  } else {
    console.log("⚠️ public_forms is empty");
  }

  // Try fetching from 'forms' table directly (might fail due to RLS)
  console.log("🔍 Listing Forms (Direct Table)...");
  const { data: rawForms, error: rawError } = await supabase
    .from("forms")
    .select("*")
    .limit(5);

  if (rawError) console.error("❌ Error fetching forms table:", rawError);
  else if (rawForms && rawForms.length > 0) {
    console.log("✅ forms table columns:", Object.keys(rawForms[0]));
    rawForms.forEach((f) => {
      console.log(
        `- [${f.id}] ${f.name} (Store: ${f.store_id}, Active: ${f.active})`,
      );
    });
  } else {
    console.log("⚠️ No forms found in 'forms' table");
  }

  // Original logic for listing public forms (modified to use the 'forms' variable from above)
  // Re-fetch with specific columns if needed, or just use the 'forms' from the debug step
  // For now, let's assume the debug fetch is sufficient for the first part of the original logic
  // If we need to list ALL forms, we'd need another fetch without limit(1)
  const { data: allForms, error: allFormsError } = await supabase
    .from("public_forms")
    .select("id, name, store_id, active");

  if (allFormsError) {
    console.error("❌ Error fetching all public forms:", allFormsError);
    return;
  }

  if (!allForms || allForms.length === 0) {
    console.log("⚠️ No public forms found.");
  } else {
    console.log(`✅ Found ${allForms.length} forms:`);
    allForms.forEach((f) => {
      console.log(
        `- [${f.id}] ${f.name} (Active: ${f.active}, Store: ${f.store_id})`,
      );
    });
  }

  // Also verify DB write access by listing tags just to be sure
  // We don't write here, but reading tags confirms more access
  const { data: tags, error: tagError } = await supabase
    .from("tags")
    .select("id, name")
    .limit(3);
  if (tagError) console.error("⚠️ Error reading tags:", tagError);
  else console.log(`✅ Can read tags (${tags?.length} found)`);
}

listForms();
