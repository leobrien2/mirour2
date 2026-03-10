-- ============================================================
-- Analytics Enrichment Migration
-- Additive only — no breaking changes, no existing data modified
-- ============================================================

-- ── 1. flow_sessions: add missing tracking fields ─────────────────────────────

ALTER TABLE public.flow_sessions
  ADD COLUMN IF NOT EXISTS drop_off_node_id  TEXT,          -- node where user abandoned (set in markAbandoned)
  ADD COLUMN IF NOT EXISTS total_time_seconds INT,           -- seconds from start→complete (set in completeSession)
  ADD COLUMN IF NOT EXISTS flow_version       TEXT DEFAULT 'v1';  -- which version of the flow was shown

-- ── 2. form_visits: mark return visitors ──────────────────────────────────────

ALTER TABLE public.form_visits
  ADD COLUMN IF NOT EXISTS is_return_visitor BOOLEAN DEFAULT false;  -- true if visitor_id seen before for this form

-- ── 3. customers: track recency + visit frequency ─────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_active  TIMESTAMPTZ,    -- updated on every visit/session linkage
  ADD COLUMN IF NOT EXISTS visit_count  INT DEFAULT 1;  -- incremented each time identity is linked

-- ── 4. saved_items: POS placeholder for future purchase linking ───────────────
-- Stays NULL forever until a POS integration writes here.
-- Allows querying "saved but not purchased" without schema changes later.

ALTER TABLE public.saved_items
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;    -- NULL = not purchased; set by POS integration

-- ── 5. forms: version field for A/B tracking ─────────────────────────────────

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS flow_version TEXT DEFAULT 'v1';

-- ── 6. visitor_location_journeys: cross-location cross-session tracking ───────
-- One row per (visitor_id, store_id, session_id) — tiny table.
-- Lets you see "same browser visited store A and store B".

CREATE TABLE IF NOT EXISTS public.visitor_location_journeys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id   TEXT            NOT NULL,   -- localStorage mirour_visitor_id (device fingerprint)
  customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,  -- set when identity captured
  store_id     UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  session_id   TEXT,                        -- matches flow_sessions.id
  visited_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one row per visitor per session to avoid duplicate writes
CREATE UNIQUE INDEX IF NOT EXISTS idx_vlj_unique_visitor_session
  ON public.visitor_location_journeys (visitor_id, session_id)
  WHERE session_id IS NOT NULL;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_vlj_visitor    ON public.visitor_location_journeys (visitor_id);
CREATE INDEX IF NOT EXISTS idx_vlj_customer   ON public.visitor_location_journeys (customer_id);
CREATE INDEX IF NOT EXISTS idx_vlj_store      ON public.visitor_location_journeys (store_id);
CREATE INDEX IF NOT EXISTS idx_vlj_visited_at ON public.visitor_location_journeys (visited_at DESC);

-- RLS: anonymous shoppers can insert (they write their own journey row)
--      authenticated store owners can read their store's journeys
ALTER TABLE public.visitor_location_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert journeys"
  ON public.visitor_location_journeys
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owners can read journeys"
  ON public.visitor_location_journeys
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = visitor_location_journeys.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- ── 7. Update link_anonymous_session to also backfill visitor_location_journeys ─

CREATE OR REPLACE FUNCTION public.link_anonymous_session(
    p_store_id   UUID,
    p_session_id TEXT,
    p_customer_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Backfill customer_id on customer_tags
    UPDATE public.customer_tags
    SET customer_id = p_customer_id
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

    -- Backfill customer_id on interactions
    UPDATE public.interactions
    SET customer_id = p_customer_id
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

    -- Move anonymous saved_items → customer-linked rows
    INSERT INTO public.saved_items (store_id, customer_id, session_id, product_id)
    SELECT p_store_id, p_customer_id, p_session_id, si.product_id
    FROM public.saved_items si
    WHERE si.session_id = p_session_id
      AND si.store_id   = p_store_id
      AND si.customer_id IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.saved_items ex
          WHERE ex.customer_id = p_customer_id AND ex.product_id = si.product_id
      );

    DELETE FROM public.saved_items
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

    -- Backfill customer_id on visitor_location_journeys
    UPDATE public.visitor_location_journeys
    SET customer_id = p_customer_id
    WHERE session_id = p_session_id AND store_id = p_store_id AND customer_id IS NULL;

    -- Bump visit_count + last_active on customer record
    UPDATE public.customers
    SET
      visit_count = COALESCE(visit_count, 1) + 1,
      last_active = now()
    WHERE id = p_customer_id;

END;
$$;
