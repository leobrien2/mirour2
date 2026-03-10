-- Allow anyone to read responses for active forms
-- This enables INSERT...RETURNING to work for anonymous submissions
CREATE POLICY "Anyone can read responses for active forms"
ON public.responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = responses.form_id 
    AND forms.active = true
  )
);