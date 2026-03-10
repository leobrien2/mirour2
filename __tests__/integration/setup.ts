import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// We need a real Supabase client for integration tests
// using the service role key to bypass RLS for setup/teardown if needed
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""; // Optional

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing Supabase env vars, integration tests may fail");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to create unique test data
export const createTestStore = async (prefix: string) => {
  const name = `${prefix}_${Date.now()}`;
  const { data, error } = await supabase
    .from("stores")
    .insert({ name, location: "Test Location" })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestZone = async (storeId: string, name: string) => {
  const { data, error } = await supabase
    .from("zones")
    .insert({ store_id: storeId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
};
