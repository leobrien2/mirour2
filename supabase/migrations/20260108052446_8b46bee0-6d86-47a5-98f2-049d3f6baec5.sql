-- Create a function to get profile data for a form (accessible by anyone)
CREATE OR REPLACE FUNCTION public.get_form_profile(form_id_param UUID)
RETURNS TABLE (
  business_name TEXT,
  business_logo TEXT
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.business_name,
    p.business_logo
  FROM profiles p
  INNER JOIN forms f ON f.owner_id = p.id
  WHERE f.id = form_id_param
  AND f.active = true;
$$;