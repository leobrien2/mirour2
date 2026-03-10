-- Allow anyone to read profiles for displaying business info on customer forms
CREATE POLICY "Anyone can view profiles for public display"
ON public.profiles
FOR SELECT
USING (true);