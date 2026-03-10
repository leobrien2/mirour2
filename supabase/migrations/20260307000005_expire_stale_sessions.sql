-- ============================================================
-- Auto-expire stale in_progress sessions
-- ============================================================
-- Sessions that were never marked abandoned (browser crash, network cut, etc.)
-- will stay in_progress forever without this function.
--
-- Usage (manual):
--   SELECT expire_stale_sessions(30);   -- expire any session idle > 30 min
--
-- Usage (scheduled via pg_cron):
--   Enable extension: Supabase Dashboard > Database > Extensions > pg_cron
--   Then run once:
--   SELECT cron.schedule(
--     'expire-stale-sessions',
--     '*/15 * * * *',
--     'SELECT expire_stale_sessions(30)'
--   );
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_stale_sessions(stale_minutes INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.flow_sessions
  SET
    status           = 'abandoned',
    last_activity_at = NOW()
  WHERE
    status           = 'in_progress'
    AND last_activity_at < NOW() - (stale_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Store owners can call this from their dashboard if desired
GRANT EXECUTE ON FUNCTION public.expire_stale_sessions(INT) TO authenticated;
