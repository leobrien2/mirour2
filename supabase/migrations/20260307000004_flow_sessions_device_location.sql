-- ============================================================
-- Device and Location Enrichment Migration
-- Adds explicit fields to flow_sessions for easier querying
-- ============================================================

ALTER TABLE public.flow_sessions
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;
