-- ============================================================
-- Fix: unindexed join in get_touchpoint_metrics()
-- ============================================================
-- The analytics function joins saved_items to flow_sessions like this:
--   JOIN public.flow_sessions fs ON fs.id::text = si.session_id
--
-- The ::text cast on fs.id (a UUID column) disables index use and forces
-- a sequential scan on flow_sessions at every analytics call.
--
-- This migration adds a functional index so the cast is pre-computed,
-- letting Postgres use an index scan for the join.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_flow_sessions_id_text
  ON public.flow_sessions ((id::text));
