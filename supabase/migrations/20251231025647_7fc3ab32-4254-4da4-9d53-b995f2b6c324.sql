-- Drop the public read policy from forms table
DROP POLICY IF EXISTS "Anyone can read active forms" ON public.forms;

-- Create a secure view that only exposes public-safe columns
CREATE OR REPLACE VIEW public.public_forms AS
SELECT 
  id,
  name,
  perk,
  questions,
  capture_name,
  capture_email,
  capture_phone,
  active,
  created_at,
  updated_at
FROM public.forms
WHERE active = true;

-- Grant access to the view for anonymous and authenticated users
GRANT SELECT ON public.public_forms TO anon;
GRANT SELECT ON public.public_forms TO authenticated;