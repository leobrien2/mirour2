import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// createBrowserClient (from @supabase/ssr) stores the session in cookies
// instead of localStorage — this is required for the Next.js middleware to
// be able to read the session server-side and protect routes correctly.
export const supabase = createBrowserClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);
