-- ============================================================
-- COMPLETE DATA CAPTURE MIGRATION
-- Safe to run — uses IF NOT EXISTS throughout
-- ============================================================


-- ============================================================
-- SECTION 1: flow_session_nodes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.flow_session_nodes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL REFERENCES public.flow_sessions(id) ON DELETE CASCADE,
    form_id             UUID        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    node_id             TEXT        NOT NULL,
    block_id            TEXT        DEFAULT NULL,       -- which block inside the node was answered
    answer_value        JSONB       DEFAULT NULL,       -- the answer given on this node (JSONB handles string/array/number)
    entered_at          TIMESTAMPTZ DEFAULT now(),
    exited_at           TIMESTAMPTZ DEFAULT NULL,
    time_spent_seconds  INTEGER     DEFAULT NULL,
    is_dropoff          BOOLEAN     DEFAULT true
);

-- Add columns if table already existed without them
ALTER TABLE public.flow_session_nodes
    ADD COLUMN IF NOT EXISTS block_id       TEXT    DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS answer_value   JSONB   DEFAULT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flow_session_nodes_session    ON public.flow_session_nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_session_nodes_form       ON public.flow_session_nodes(form_id);
CREATE INDEX IF NOT EXISTS idx_flow_session_nodes_node       ON public.flow_session_nodes(node_id);

-- RLS
ALTER TABLE public.flow_session_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for anon/authenticated users" ON public.flow_session_nodes;
DROP POLICY IF EXISTS "Enable update for anon/authenticated users" ON public.flow_session_nodes;
DROP POLICY IF EXISTS "Enable select for anon/authenticated users" ON public.flow_session_nodes;

CREATE POLICY "flow_session_nodes_insert" ON public.flow_session_nodes
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "flow_session_nodes_update" ON public.flow_session_nodes
    FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "flow_session_nodes_select" ON public.flow_session_nodes
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.forms
        WHERE forms.id = flow_session_nodes.form_id
        AND forms.owner_id = auth.uid()
    ));


-- ============================================================
-- SECTION 2: submission_answers
-- Single clean definition — merges both versions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.submission_answers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        REFERENCES public.flow_sessions(id) ON DELETE SET NULL,
    response_id     UUID        REFERENCES public.responses(id) ON DELETE CASCADE,
    customer_id     UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
    form_id         UUID        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    question_id     TEXT        NOT NULL,           -- block ID
    question_label  TEXT        DEFAULT NULL,       -- human readable label (e.g. "What are you exploring today?")
    answer_value    JSONB       NOT NULL,           -- JSONB handles string, array, number all in one
    answered_at     TIMESTAMPTZ DEFAULT NULL,       -- exact moment this question was answered
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Safely add missing columns if table already existed as the old version
ALTER TABLE public.submission_answers
    ADD COLUMN IF NOT EXISTS session_id     UUID        REFERENCES public.flow_sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS question_label TEXT        DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS answered_at    TIMESTAMPTZ DEFAULT NULL;

-- If answer_value was TEXT before, migrate it to JSONB
-- (only runs if column is text type)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'submission_answers'
        AND column_name = 'answer_value'
        AND data_type = 'text'
    ) THEN
        ALTER TABLE public.submission_answers
            ALTER COLUMN answer_value TYPE JSONB USING answer_value::jsonb;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submission_answers_session    ON public.submission_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_response   ON public.submission_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_customer   ON public.submission_answers(customer_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_form       ON public.submission_answers(form_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_question   ON public.submission_answers(question_id);

-- RLS
ALTER TABLE public.submission_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert submission answers"        ON public.submission_answers;
DROP POLICY IF EXISTS "Form owners can view submission answers"     ON public.submission_answers;
DROP POLICY IF EXISTS "Enable insert for anon/authenticated users"  ON public.submission_answers;
DROP POLICY IF EXISTS "Enable select for anon/authenticated users"  ON public.submission_answers;

CREATE POLICY "submission_answers_insert" ON public.submission_answers
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "submission_answers_select" ON public.submission_answers
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.forms
        WHERE forms.id = submission_answers.form_id
        AND forms.owner_id = auth.uid()
    ));


-- ============================================================
-- SECTION 3: responses table — add missing columns
-- ============================================================

ALTER TABLE public.responses
    ADD COLUMN IF NOT EXISTS session_id     UUID    REFERENCES public.flow_sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS form_snapshot  JSONB   DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_responses_session_id ON public.responses(session_id);


-- ============================================================
-- SECTION 4: answer_revisions — track when user goes back
-- and changes a previously selected option
-- ============================================================

CREATE TABLE IF NOT EXISTS public.answer_revisions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID        NOT NULL REFERENCES public.flow_sessions(id) ON DELETE CASCADE,
    form_id          UUID        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    block_id         TEXT        NOT NULL,
    node_id          TEXT        DEFAULT NULL,
    question_label   TEXT        DEFAULT NULL,
    previous_value   JSONB       NOT NULL,
    new_value        JSONB       NOT NULL,
    revision_number  INT         NOT NULL DEFAULT 1,
    revised_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_answer_revisions_session ON public.answer_revisions(session_id);
CREATE INDEX IF NOT EXISTS idx_answer_revisions_form    ON public.answer_revisions(form_id);
CREATE INDEX IF NOT EXISTS idx_answer_revisions_block   ON public.answer_revisions(block_id);

ALTER TABLE public.answer_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "answer_revisions_insert" ON public.answer_revisions
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "answer_revisions_select" ON public.answer_revisions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.forms
        WHERE forms.id = answer_revisions.form_id
        AND forms.owner_id = auth.uid()
    ));


-- ============================================================
--
