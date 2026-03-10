import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LocationMetrics } from "@/types/analytics";

/**
 * Fetches store-level rollup analytics from the
 * get_location_metrics() Postgres RPC.
 *
 * Usage:
 *   const { metrics, loading, error, refetch } = useLocationAnalytics(storeId);
 */
export const useLocationAnalytics = (storeId: string | undefined) => {
  const [metrics, setMetrics] = useState<LocationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "get_location_metrics",
        { p_store_id: storeId },
      );

      if (rpcError) throw rpcError;
      setMetrics(data as LocationMetrics);
    } catch (err: any) {
      console.error("useLocationAnalytics:", err);
      setError(err?.message || "Failed to load location metrics");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { metrics, loading, error, refetch: fetch };
};
