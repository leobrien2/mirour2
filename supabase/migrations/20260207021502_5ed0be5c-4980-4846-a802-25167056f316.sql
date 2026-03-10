-- Fix flow_sessions RLS policies - they need to be PERMISSIVE, not RESTRICTIVE

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can create flow sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Form owners can view sessions" ON public.flow_sessions;
DROP POLICY IF EXISTS "Visitors can update their own sessions" ON public.flow_sessions;

-- Re-create as PERMISSIVE policies (default)
CREATE POLICY "Anyone can create flow sessions"
  ON public.flow_sessions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Form owners can view sessions"
  ON public.flow_sessions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = flow_sessions.form_id
    AND forms.owner_id = auth.uid()
  ));

CREATE POLICY "Visitors can update their own sessions"
  ON public.flow_sessions
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);