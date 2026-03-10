require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('id', '309e3150-0d1c-4423-ae67-326b06252db4')
    .single();

  console.log('Error:', error);
  console.log('Data:', data);
}

run();
