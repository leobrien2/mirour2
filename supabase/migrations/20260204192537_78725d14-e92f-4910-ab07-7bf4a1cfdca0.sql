-- Re-add policy allowing public read access to active forms
-- This is required for:
-- 1. The public_forms view to work for anonymous users
-- 2. Foreign key validation when inserting responses/flow_sessions
CREATE POLICY "Anyone can read active forms"
ON public.forms
FOR SELECT
USING (active = true);