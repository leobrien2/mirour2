-- 1. Create flow_session_nodes table
CREATE TABLE IF NOT EXISTS public.flow_session_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.flow_sessions(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    exited_at TIMESTAMPTZ,
    time_spent_seconds INTEGER,
    is_dropoff BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_session_nodes_session ON public.flow_session_nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_session_nodes_form ON public.flow_session_nodes(form_id);

-- RLS
ALTER TABLE public.flow_session_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for anon/authenticated users" ON public.flow_session_nodes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable update for anon/authenticated users" ON public.flow_session_nodes FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Enable select for anon/authenticated users" ON public.flow_session_nodes FOR SELECT TO anon, authenticated USING (true);

-- 2. Create submission_answers table
CREATE TABLE IF NOT EXISTS public.submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    question_label TEXT,
    answer_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submission_answers_form ON public.submission_answers(form_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_customer ON public.submission_answers(customer_id);

-- RLS
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for anon/authenticated users" ON public.submission_answers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable select for anon/authenticated users" ON public.submission_answers FOR SELECT TO anon, authenticated USING (true);
