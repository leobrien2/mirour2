"use client";

import { DashboardForm } from "@/types/dashboard";
import { Users, Clock, Repeat, Activity, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type WorkspaceMetricsProps = {
  forms: DashboardForm[];
};

export function WorkspaceMetrics({ forms }: WorkspaceMetricsProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    completions: 0,
    avgTimeSeconds: 0,
    repeatPercentage: 0,
    totalDropOffs: 0,
  });

  const formatTime = (seconds: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const formIds = forms.map((f) => f.id);
        if (formIds.length === 0) {
          setMetrics({
            completions: 0,
            avgTimeSeconds: 0,
            repeatPercentage: 0,
            totalDropOffs: 0,
          });
          setLoading(false);
          return;
        }

        // 1. Overall Completions
        const { count: completionsCount } = await supabase
          .from("flow_sessions")
          .select("*", { count: "exact", head: true })
          .in("form_id", formIds)
          .eq("status", "completed");

        // 2. Average Time in Flow
        const { data: completedSessions } = await supabase
          .from("flow_sessions")
          .select("started_at, completed_at, last_activity_at")
          .in("form_id", formIds)
          .eq("status", "completed")
          .limit(1000);

        let avgTimeSeconds = 0;
        if (completedSessions && completedSessions.length > 0) {
          const totalMs = completedSessions.reduce((acc, s) => {
             // @ts-ignore
            const endStr = s.completed_at || s.last_activity_at;
            if (!endStr || !s.started_at) return acc;
            const end = new Date(endStr).getTime();
            const start = new Date(s.started_at).getTime();
            return acc + Math.max(0, end - start);
          }, 0);
          avgTimeSeconds = totalMs / completedSessions.length / 1000;
        }

        // 3. Repeat Percentage
        const { data: visits } = await supabase
          .from("form_visits")
          .select("visitor_id")
          .in("form_id", formIds)
          .limit(5000);

        let repeatPercentage = 0;
        if (visits && visits.length > 0) {
          const visitorCounts = visits.reduce(
            (acc, v) => {
              if (v.visitor_id) {
                acc[v.visitor_id] = (acc[v.visitor_id] || 0) + 1;
              }
              return acc;
            },
            {} as Record<string, number>,
          );

          const uniqueVisitors = Object.keys(visitorCounts).length;
          const repeatVisitors = Object.values(visitorCounts).filter(
            (c) => (c as number) > 1,
          ).length;
          repeatPercentage =
            uniqueVisitors > 0 ? (repeatVisitors / uniqueVisitors) * 100 : 0;
        }

        // 4. Total Drop-offs
        const { data: abandonedSessions } = await supabase
          .from("flow_sessions")
          .select("last_activity_at")
          .in("form_id", formIds)
          .neq("status", "completed")
          .limit(2000);

        let totalDropOffs = 0;
        if (abandonedSessions && abandonedSessions.length > 0) {
          const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
          totalDropOffs = abandonedSessions.filter((s) => {
            if (!s.last_activity_at) return true;
            return new Date(s.last_activity_at).getTime() < thirtyMinsAgo;
          }).length;
        }

        setMetrics({
          completions: completionsCount || 0,
          avgTimeSeconds,
          repeatPercentage,
          totalDropOffs,
        });
      } catch (err) {
        console.error("Error fetching workspace metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [forms]);

  return (
    <div className="mb-10 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-foreground tracking-tight">Workspace Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Performance overview across all your flows.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Completions */}
        <Card className="border border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Overall Completions
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-4 h-4 text-primary" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-9 bg-secondary animate-pulse rounded w-1/2" />
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-bold tracking-tight text-foreground">
                  {metrics.completions.toLocaleString()}
                </div>
                <div className="text-xs font-medium text-green-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> All time
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Avg Time */}
        <Card className="border border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Average Time in Flow
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-9 bg-secondary animate-pulse rounded w-1/2" />
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-bold tracking-tight text-foreground">
                  {formatTime(metrics.avgTimeSeconds)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repeaters */}
        <Card className="border border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Repeat Scanners
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Repeat className="w-4 h-4 text-emerald-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-9 bg-secondary animate-pulse rounded w-1/2" />
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl font-bold tracking-tight text-foreground">
                    {metrics.repeatPercentage.toFixed(1)}%
                  </div>
                </div>
                <Progress
                  value={metrics.repeatPercentage}
                  className="h-1.5 mt-2 bg-secondary"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dropoffs */}
        <Card className="border border-border/50 shadow-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Flow Drop-offs
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <Activity className="w-4 h-4 text-rose-500" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-9 bg-secondary animate-pulse rounded w-1/2" />
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-bold tracking-tight text-foreground">
                  {metrics.totalDropOffs.toLocaleString()}
                </div>
                <span className="text-xs text-muted-foreground">
                  abandoned sessions
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
