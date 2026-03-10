"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zone } from "@/types/mirour";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, QrCode, TrendingUp, Users } from "lucide-react";

interface ZoneAnalyticsProps {
  storeId: string;
  zones: Zone[];
}

interface ZoneStat {
  zoneId: string;
  zoneName: string;
  scans: number;
  conversions: number; // Placeholder for now (responses linked to this zone)
}

export function ZoneAnalytics({ storeId, zones }: ZoneAnalyticsProps) {
  const [stats, setStats] = useState<ZoneStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalScans, setTotalScans] = useState(0);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        // 1. Get all zone IDs for this store
        const zoneIds = zones.map((z) => z.id);

        if (zoneIds.length === 0) {
          setStats([]);
          setLoading(false);
          return;
        }

        // 2. Query form_visits grouped by zone_id
        // Since we can't easily do GROUP BY in raw Supabase JS client without Views or RPC,
        // we will fetch raw visits for these zones and aggregate client-side for MVP.
        // Optimization: In Phase 2, move this to an RPC or View.

        const { data: visits, error } = await supabase
          .from("form_visits")
          .select("zone_id")
          .in("zone_id", zoneIds);

        if (error) throw error;

        // 3. Aggregate
        const zoneCounts: Record<string, number> = {};
        let total = 0;

        // Initialize counts
        zones.forEach((z) => (zoneCounts[z.id] = 0));

        visits?.forEach((v: any) => {
          if (v.zone_id) {
            zoneCounts[v.zone_id] = (zoneCounts[v.zone_id] || 0) + 1;
            total++;
          }
        });

        const chartData = zones
          .map((z) => ({
            zoneId: z.id,
            zoneName: z.name,
            scans: zoneCounts[z.id] || 0,
            conversions: 0, // TODO: Link responses to zones to calculate this
          }))
          .sort((a, b) => b.scans - a.scans); // Sort by highest scans

        setStats(chartData);
        setTotalScans(total);
      } catch (err) {
        console.error("Error fetching zone analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [storeId, zones]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <QrCode className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">
              Total Zone Scans
            </span>
          </div>
          <p className="text-2xl font-bold">{totalScans}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Top Zone</span>
          </div>
          <p className="text-xl font-bold truncate">
            {stats.length > 0 && stats[0].scans > 0 ? stats[0].zoneName : "—"}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Active Zones</span>
          </div>
          <p className="text-2xl font-bold">
            {stats.filter((s) => s.scans > 0).length}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              / {zones.length}
            </span>
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold mb-6">Scans by Zone</h3>
        <div className="h-[300px] w-full">
          {totalScans > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="zoneName"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
                <Bar
                  dataKey="scans"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                >
                  {stats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(var(--primary) / ${1 - index * 0.1})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-sm">No scan data available yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
