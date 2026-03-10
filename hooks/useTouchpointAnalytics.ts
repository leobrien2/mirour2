import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TouchpointMetrics } from "@/types/analytics";

/**
 * Fetches per-touchpoint (per-form) analytics from the
 * get_touchpoint_metrics() Postgres RPC.
 *
 * Usage:
 *   const { metrics, loading, error, refetch } = useTouchpointAnalytics(formId);
 */
export const useTouchpointAnalytics = (formId: string | undefined) => {
  const [metrics, setMetrics] = useState<TouchpointMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!formId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "get_touchpoint_metrics",
        { p_form_id: formId },
      );

      if (rpcError) throw rpcError;
      setMetrics(data as TouchpointMetrics);
    } catch (err: any) {
      console.error("useTouchpointAnalytics:", err);
      setError(err?.message || "Failed to load touchpoint metrics");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { metrics, loading, error, refetch: fetch };
};
