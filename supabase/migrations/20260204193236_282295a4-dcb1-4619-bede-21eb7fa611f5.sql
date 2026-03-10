-- Fix responses table - drop restrictive and create permissive
DROP POLICY IF EXISTS "Anyone can create responses" ON public.responses;
CREATE POLICY "Anyone can create responses" ON public.responses 
  FOR INSERT TO public WITH CHECK (true);

-- Fix flow_sessions table - drop restrictive and create permissive
DROP POLICY IF EXISTS "Anyone can create flow sessions" ON public.flow_sessions;
CREATE POLICY "Anyone can create flow sessions" ON public.flow_sessions 
  FOR INSERT TO public WITH CHECK (true);

-- Fix form_visits table - drop restrictive and create permissive
DROP POLICY IF EXISTS "Anyone can create form visits" ON public.form_visits;
CREATE POLICY "Anyone can create form visits" ON public.form_visits 
  FOR INSERT TO public WITH CHECK (true);