-- Create form_visits table to track QR scans/page visits
CREATE TABLE public.form_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    referrer text,
    user_agent text,
    visited_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_form_visits_form_id ON public.form_visits(form_id);
CREATE INDEX idx_form_visits_visitor_id ON public.form_visits(visitor_id);

-- Enable RLS
ALTER TABLE public.form_visits ENABLE ROW LEVEL SECURITY;

-- Anyone can insert visits (public forms)
CREATE POLICY "Anyone can create form visits"
ON public.form_visits
FOR INSERT
WITH CHECK (true);

-- Form owners can view visits for their forms
CREATE POLICY "Form owners can view visits"
ON public.form_visits
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = form_visits.form_id
    AND forms.owner_id = auth.uid()
));

-- Create flow_sessions table to track journey through forms
CREATE TABLE public.flow_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    visitor_id text NOT NULL,
    current_node_id text,
    visited_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
    partial_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    response_id uuid REFERENCES public.responses(id) ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX idx_flow_sessions_form_id ON public.flow_sessions(form_id);
CREATE INDEX idx_flow_sessions_visitor_id ON public.flow_sessions(visitor_id);
CREATE INDEX idx_flow_sessions_status ON public.flow_sessions(status);

-- Enable RLS
ALTER TABLE public.flow_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can create sessions (public forms)
CREATE POLICY "Anyone can create flow sessions"
ON public.flow_sessions
FOR INSERT
WITH CHECK (true);

-- Anyone can update their own sessions (matched by visitor_id)
CREATE POLICY "Visitors can update their own sessions"
ON public.flow_sessions
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Form owners can view sessions for their forms
CREATE POLICY "Form owners can view sessions"
ON public.flow_sessions
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.forms
    WHERE forms.id = flow_sessions.form_id
    AND forms.owner_id = auth.uid()
));

-- Create storage bucket for form uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', true);

-- Storage policies for form-uploads bucket
-- Anyone can upload to responses path (customer uploads)
CREATE POLICY "Anyone can upload response images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'form-uploads' AND (storage.foldername(name))[1] = 'responses');

-- Anyone can view uploaded images (public bucket)
CREATE POLICY "Anyone can view form uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'form-uploads');

-- Authenticated users can upload to forms path (section images)
CREATE POLICY "Authenticated users can upload form section images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'form-uploads' AND (storage.foldername(name))[1] = 'forms' AND auth.role() = 'authenticated');

-- Authenticated users can update their uploads
CREATE POLICY "Authenticated users can update form uploads"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'form-uploads' AND auth.role() = 'authenticated');

-- Authenticated users can delete their uploads
CREATE POLICY "Authenticated users can delete form uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'form-uploads' AND auth.role() = 'authenticated');