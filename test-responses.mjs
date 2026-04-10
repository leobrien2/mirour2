import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if(!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials from env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('responses').select('answers').limit(10);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
main();
