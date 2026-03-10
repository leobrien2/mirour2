"use client";

import { DashboardForm } from "@/types/dashboard";
import ReactECharts from "echarts-for-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScanLine,
  CheckCircle2,
  Clock,
  Repeat,
  ArrowDownRight,
  Activity,
  CalendarDays,
  Heart,
  MessageSquare,
  Link2,
  TrendingUp,
  ChevronDown,
} from "lucide-react";

// ── Theme constants ───────────────────────────────────────────────────────────
const C = {
  text: "#64748b",
  grid: "rgba(148,163,184,0.05)",
  axis: "rgba(148,163,184,0.10)",
  tooltip: { bg: "rgba(10,10,15,0.92)", border: "rgba(148,163,184,0.12)" },
  purple: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  indigo: "#6366f1",
  red: "#ef4444",
  pink: "#ec4899",
  blue: "#3b82f6",
} as const;

function tooltip(extra?: object) {
  return {
    backgroundColor: C.tooltip.bg,
    borderColor: C.tooltip.border,
    borderRadius: 12,
    textStyle: { color: "#e2e8f0", fontSize: 12 },
    ...extra,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSecs(s: number): string {
  if (!s || s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function nodeLabel(id: string, forms: DashboardForm[]): string {
  if (id === "Exit/Start") return "Start Screen";
  for (const f of forms) {
    const n = (f.questions || []).find((q: any) => q.id === id) as any;
    if (n) {
      const lbl = n.label || n.header || n.title;
      if (lbl && lbl !== id) return lbl;
    }
  }
  return id
    .replace(/^node-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`bg-white/[0.04] animate-pulse rounded-xl ${className}`} />
);

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/40">
      {icon}
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  badge,
  loading,
  empty,
  emptyIcon,
  emptyText,
  height,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  loading: boolean;
  empty?: boolean;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      {loading ? (
        <div style={{ height: height || 160 }}>
          <Skeleton className="w-full h-full" />
        </div>
      ) : empty ? (
        <EmptyState
          icon={emptyIcon || icon}
          text={emptyText || "No data yet"}
        />
      ) : (
        children
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Kpis {
  totalScans: number;
  uniqueVisitors: number;
  completions: number;
  completionRate: number;
  avgTimeSec: number;
  repeatPct: number;
}
interface DropOff {
  node: string;
  label: string;
  count: number;
  pct: number;
}
interface LinkItem {
  url: string;
  title: string;
  count: number;
}
interface SavedItem {
  name: string;
  img: string | null;
  count: number;
}
interface TopResp {
  question: string;
  answer: string;
  count: number;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Analytics({ forms }: { forms: DashboardForm[] }) {
  const [selectedFormId, setSelectedFormId] = useState("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(true);

  const [kpis, setKpis] = useState<Kpis>({
    totalScans: 0,
    uniqueVisitors: 0,
    completions: 0,
    completionRate: 0,
    avgTimeSec: 0,
    repeatPct: 0,
  });
  const [scansSeries, setScansSeries] = useState<
    { date: string; count: number }[]
  >([]);
  const [peakHours, setPeakHours] = useState<{ h: string; v: number }[]>([]);
  const [peakDays, setPeakDays] = useState<{ d: string; v: number }[]>([]);
  const [dropOffs, setDropOffs] = useState<DropOff[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [topResps, setTopResps] = useState<TopResp[]>([]);

  const filteredForms = useMemo(
    () =>
      selectedFormId === "all"
        ? forms
        : forms.filter((f) => f.id === selectedFormId),
    [forms, selectedFormId],
  );
  const formIds = useMemo(
    () => filteredForms.map((f) => f.id),
    [filteredForms],
  );
  const storeIds = useMemo(
    () =>
      Array.from(
        new Set(
          filteredForms
            .map((f: any) => f.store_id || f.storeid)
            .filter(Boolean),
        ),
      ) as string[],
    [filteredForms],
  );
  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setDate(
      d.getDate() - (timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90),
    );
    return d.toISOString();
  }, [timeRange]);

  // ── Data Fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!formIds.length) {
      setLoading(false);
      return;
    }
    setLoading(true);

    (async () => {
      try {
        await Promise.all([
          (async () => {
            // ── KPIs ──
            const { data: visits } = await supabase
              .from("form_visits")
              .select("visitor_id")
              .in("form_id", formIds)
              .gte("visited_at", rangeStart);

            const visMap: Record<string, number> = {};
            (visits || []).forEach((v) => {
              if (v.visitor_id)
                visMap[v.visitor_id] = (visMap[v.visitor_id] || 0) + 1;
            });
            const unique = Object.keys(visMap).length;
            const repeats = Object.values(visMap).filter((c) => c > 1).length;
            const totalScans = visits?.length || 0;

            const { data: sessions } = await supabase
              .from("flow_sessions")
              .select(
                "status, total_time_seconds, started_at, completed_at, last_activity_at",
              )
              .in("form_id", formIds)
              .gte("started_at", rangeStart);

            const completed = (sessions || []).filter(
              (s) => s.status === "completed",
            );
            const timesArr = completed
              .map((s) => {
                if (s.total_time_seconds) return s.total_time_seconds;
                const end = s.completed_at || s.last_activity_at;
                if (!end || !s.started_at) return null;
                return (
                  (new Date(end).getTime() - new Date(s.started_at).getTime()) /
                  1000
                );
              })
              .filter((t): t is number => t !== null && t > 0);

            setKpis({
              totalScans,
              uniqueVisitors: unique,
              completions: completed.length,
              completionRate:
                totalScans > 0 ? (completed.length / totalScans) * 100 : 0,
              avgTimeSec: timesArr.length
                ? timesArr.reduce((a, b) => a + b, 0) / timesArr.length
                : 0,
              repeatPct: unique > 0 ? (repeats / unique) * 100 : 0,
            });
          })(),

          (async () => {
            // ── Scans over time ──
            const { data } = await supabase
              .from("form_visits")
              .select("visited_at")
              .in("form_id", formIds)
              .gte("visited_at", rangeStart)
              .order("visited_at", { ascending: true });

            const map: Record<string, number> = {};
            (data || []).forEach((v) => {
              if (!v.visited_at) return;
              const d = new Date(v.visited_at).toISOString().split("T")[0];
              map[d] = (map[d] || 0) + 1;
            });
            setScansSeries(
              Object.entries(map).map(([date, count]) => ({ date, count })),
            );
          })(),

          (async () => {
            // ── Peak times ──
            const { data } = await supabase
              .from("form_visits")
              .select("visited_at")
              .in("form_id", formIds)
              .gte("visited_at", rangeStart);

            const hMap: Record<number, number> = {};
            const dMap: Record<string, number> = {};
            const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            (data || []).forEach((v) => {
              if (!v.visited_at) return;
              const dt = new Date(v.visited_at);
              hMap[dt.getHours()] = (hMap[dt.getHours()] || 0) + 1;
              dMap[DAYS[dt.getDay()]] = (dMap[DAYS[dt.getDay()]] || 0) + 1;
            });
            setPeakHours(
              Array.from({ length: 24 }, (_, i) => {
                const h =
                  i === 0
                    ? "12am"
                    : i < 12
                      ? `${i}am`
                      : i === 12
                        ? "12pm"
                        : `${i - 12}pm`;
                return { h, v: hMap[i] || 0 };
              }),
            );
            setPeakDays(DAYS.map((d) => ({ d, v: dMap[d] || 0 })));
          })(),

          (async () => {
            // ── Drop-offs ──
            const { data: nodeData } = await (supabase as any)
              .from("flow_session_nodes")
              .select("node_id, form_id")
              .in("form_id", formIds)
              .eq("is_dropoff", true)
              .gte("entered_at", rangeStart);

            if (nodeData?.length) {
              const m: Record<string, number> = {};
              nodeData.forEach((n: any) => {
                m[n.node_id] = (m[n.node_id] || 0) + 1;
              });
              const total = Object.values(m).reduce(
                (a: number, b: number) => a + b,
                0,
              );
              setDropOffs(
                Object.entries(m)
                  .map(([node, count]) => ({
                    node,
                    label: nodeLabel(node, forms),
                    count: Number(count),
                    pct: total > 0 ? (Number(count) / total) * 100 : 0,
                  }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8),
              );
              return;
            }
            // Fallback
            const { data: sessions } = await supabase
              .from("flow_sessions")
              .select("drop_off_node_id, current_node_id, last_activity_at")
              .in("form_id", formIds)
              .neq("status", "completed")
              .gte("started_at", rangeStart);
            const cutoff = Date.now() - 30 * 60 * 1000;
            const dropped = (sessions || []).filter(
              (s) =>
                !s.last_activity_at ||
                new Date(s.last_activity_at).getTime() < cutoff,
            );
            const m: Record<string, number> = {};
            dropped.forEach((s) => {
              const n = s.drop_off_node_id || s.current_node_id || "Exit/Start";
              m[n] = (m[n] || 0) + 1;
            });
            const total = Object.values(m).reduce((a, b) => a + b, 0);
            setDropOffs(
              Object.entries(m)
                .map(([node, count]) => ({
                  node,
                  label: nodeLabel(node, forms),
                  count: Number(count),
                  pct: total > 0 ? (Number(count) / total) * 100 : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8),
            );
          })(),

          (async () => {
            // ── Clicked links ──
            if (!storeIds.length) return;
            const { data } = await (supabase as any)
              .from("interactions")
              .select("metadata")
              .in("store_id", storeIds)
              .eq("event_type", "link_clicked")
              .gte("created_at", rangeStart);
            const m: Record<string, { title: string; count: number }> = {};
            (data || []).forEach((i: any) => {
              const url = i.metadata?.url || "unknown";
              if (!m[url])
                m[url] = { title: i.metadata?.title || url, count: 0 };
              m[url].count++;
            });
            setLinks(
              Object.entries(m)
                .map(([url, { title, count }]) => ({ url, title, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
            );
          })(),

          (async () => {
            // ── Saved items ──
            if (!storeIds.length) return;
            const { data: si } = await (supabase as any)
              .from("saved_items")
              .select("product_id")
              .in("store_id", storeIds);
            if (!si?.length) return;
            const m: Record<string, number> = {};
            si.forEach((s: any) => {
              if (s.product_id) m[s.product_id] = (m[s.product_id] || 0) + 1;
            });
            const top5 = Object.entries(m)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .slice(0, 5);
            const pids = top5.map(([id]) => id);
            const { data: prods } = await supabase
              .from("products")
              .select("id,name,image_url")
              .in("id", pids);
            const pm: Record<string, any> = {};
            (prods || []).forEach((p: any) => {
              pm[p.id] = p;
            });
            setSaved(
              top5.map(([id, count]) => ({
                name: pm[id]?.name || id,
                img: pm[id]?.image_url || null,
                count: Number(count),
              })),
            );
          })(),

          (async () => {
            // ── Top responses ──
            const { data } = await supabase
              .from("responses")
              .select("answers")
              .in("form_id", formIds)
              .gte("submitted_at", rangeStart)
              .limit(5000);
            const qm: Record<string, Record<string, number>> = {};
            (data || []).forEach((r) => {
              const a = r.answers as Record<string, any>;
              if (!a || typeof a !== "object") return;
              Object.entries(a).forEach(([qId, val]) => {
                if (qId.startsWith("_")) return;
                const str = Array.isArray(val) ? val.join(", ") : String(val);
                if (str.length >= 80) return;
                if (!qm[qId]) qm[qId] = {};
                qm[qId][str] = (qm[qId][str] || 0) + 1;
              });
            });
            const flat: TopResp[] = [];
            Object.entries(qm).forEach(([qId, counts]) => {
              const q = nodeLabel(qId, forms);
              Object.entries(counts).forEach(([answer, count]) =>
                flat.push({ question: q, answer, count }),
              );
            });
            setTopResps(flat.sort((a, b) => b.count - a.count).slice(0, 8));
          })(),
        ]);
      } catch (e) {
        console.error("Analytics error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [formIds, storeIds, rangeStart]);

  // ── Chart options ─────────────────────────────────────────────────────────
  const scansLineOpt = useMemo(
    () => ({
      backgroundColor: "transparent",
      grid: { top: 12, right: 16, bottom: 36, left: 44 },
      tooltip: {
        trigger: "axis",
        ...tooltip(),
        formatter: (p: any) => {
          const d = p[0];
          return `<div style="padding:4px 2px"><div style="font-size:11px;color:#94a3b8;margin-bottom:2px">${d.axisValue}</div><div style="font-size:18px;font-weight:700;color:#e2e8f0">${d.value}</div><div style="font-size:11px;color:#64748b">scans</div></div>`;
        },
      },
      xAxis: {
        type: "category",
        data: scansSeries.map((d) => {
          const dt = new Date(d.date);
          return `${dt.getMonth() + 1}/${dt.getDate()}`;
        }),
        axisLine: { lineStyle: { color: C.axis } },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 11, interval: "auto" },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid } },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "none",
          data: scansSeries.map((d) => d.count),
          lineStyle: { color: C.purple, width: 2.5 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(139,92,246,0.28)" },
                { offset: 1, color: "rgba(139,92,246,0)" },
              ],
            },
          },
        },
      ],
    }),
    [scansSeries],
  );

  const peakHoursOpt = useMemo(
    () => ({
      backgroundColor: "transparent",
      grid: { top: 8, right: 8, bottom: 36, left: 36 },
      tooltip: { trigger: "axis", ...tooltip() },
      xAxis: {
        type: "category",
        data: peakHours.map((h) => h.h),
        axisLine: { lineStyle: { color: C.axis } },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 10, interval: 2 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 10 },
        splitLine: { lineStyle: { color: C.grid } },
      },
      series: [
        {
          type: "bar",
          data: peakHours.map((h) => h.v),
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: C.amber },
                { offset: 1, color: "rgba(245,158,11,0.2)" },
              ],
            },
          },
        },
      ],
    }),
    [peakHours],
  );

  const peakDaysOpt = useMemo(
    () => ({
      backgroundColor: "transparent",
      grid: { top: 8, right: 8, bottom: 32, left: 36 },
      tooltip: { trigger: "axis", ...tooltip() },
      xAxis: {
        type: "category",
        data: peakDays.map((d) => d.d),
        axisLine: { lineStyle: { color: C.axis } },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 10 },
        splitLine: { lineStyle: { color: C.grid } },
      },
      series: [
        {
          type: "bar",
          data: peakDays.map((d) => d.v),
          barMaxWidth: 32,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: C.indigo },
                { offset: 1, color: "rgba(99,102,241,0.2)" },
              ],
            },
          },
        },
      ],
    }),
    [peakDays],
  );

  const dropOffOpt = useMemo(() => {
    const rev = [...dropOffs].reverse();
    return {
      backgroundColor: "transparent",
      grid: { top: 8, right: 80, bottom: 8, left: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "none" },
        ...tooltip(),
        formatter: (p: any) => {
          const d = rev[p[0].dataIndex];
          return `<div style="padding:4px 2px"><div style="font-size:11px;color:#94a3b8">${p[0].name}</div><div style="font-weight:700;color:${C.red}">${d?.count} drop-offs</div><div style="font-size:11px;color:#64748b">${d?.pct.toFixed(0)}% of total</div></div>`;
        },
      },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: C.grid } },
      },
      yAxis: {
        type: "category",
        data: rev.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: C.text, fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: rev.map((d) => d.count),
          barMaxWidth: 20,
          label: {
            show: true,
            position: "right",
            color: "#94a3b8",
            fontSize: 11,
            formatter: (p: any) =>
              `${rev[p.dataIndex]?.count} · ${rev[p.dataIndex]?.pct.toFixed(0)}%`,
          },
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: "rgba(239,68,68,0.85)" },
                { offset: 1, color: "rgba(239,68,68,0.15)" },
              ],
            },
          },
        },
      ],
    };
  }, [dropOffs]);

  const donutOpt = useMemo(() => {
    const repeat = Math.round(kpis.repeatPct);
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item", ...tooltip() },
      series: [
        {
          type: "pie",
          radius: ["58%", "82%"],
          center: ["50%", "50%"],
          data: [
            {
              value: 100 - repeat,
              name: "Unique",
              itemStyle: { color: C.emerald, borderRadius: 3 },
            },
            {
              value: repeat,
              name: "Repeat",
              itemStyle: { color: C.purple, borderRadius: 3 },
            },
          ],
          label: { show: false },
          labelLine: { show: false },
          padAngle: 2,
          emphasis: { scale: false },
        },
      ],
    };
  }, [kpis.repeatPct]);

  // ── Derived badges ────────────────────────────────────────────────────────
  const peakHourLabel = peakHours.length
    ? peakHours.reduce((a, b) => (b.v > a.v ? b : a), peakHours[0]).h
    : null;
  const peakDayLabel = peakDays.length
    ? peakDays.reduce((a, b) => (b.v > a.v ? b : a), peakDays[0]).d
    : null;
  const selectedName =
    selectedFormId === "all"
      ? "All Flows"
      : forms.find((f) => f.id === selectedFormId)?.name || "All Flows";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Performance Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Touchpoint-level analytics for your flows
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range tabs */}
          <div className="flex gap-0.5 bg-muted p-1 rounded-xl">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${timeRange === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r === "7d" ? "7D" : r === "30d" ? "30D" : "90D"}
              </button>
            ))}
          </div>

          {/* Form selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border/60 rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-colors min-w-[160px] justify-between shadow-sm"
            >
              <span className="truncate">{selectedName}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 min-w-[190px] bg-card border border-border/60 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                  {[{ id: "all", name: "All Flows" }, ...forms].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSelectedFormId(f.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted transition-colors truncate ${selectedFormId === f.id ? "text-primary font-medium bg-primary/5" : "text-foreground"}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Scans",
            val: kpis.totalScans.toLocaleString(),
            sub: `${kpis.uniqueVisitors.toLocaleString()} unique visitors`,
            icon: <ScanLine className="w-4 h-4" />,
            color: "text-indigo-400",
            bg: "bg-indigo-500/10",
          },
          {
            label: "Completions",
            val: kpis.completions.toLocaleString(),
            sub: `${kpis.completionRate.toFixed(1)}% completion rate`,
            icon: <CheckCircle2 className="w-4 h-4" />,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Avg Time in Flow",
            val: fmtSecs(kpis.avgTimeSec),
            sub: "per completed session",
            icon: <Clock className="w-4 h-4" />,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
          {
            label: "Repeat Scanners",
            val: `${kpis.repeatPct.toFixed(1)}%`,
            sub: "of all visitors",
            icon: <Repeat className="w-4 h-4" />,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {k.label}
              </span>
              <div className={`p-2 rounded-xl ${k.bg}`}>
                <span className={k.color}>{k.icon}</span>
              </div>
            </div>
            {loading ? (
              <>
                <Skeleton className="h-8 w-20 mt-1" />
                <Skeleton className="h-3 w-32 mt-1" />
              </>
            ) : (
              <>
                <div className="text-3xl font-bold tracking-tight text-foreground">
                  {k.val}
                </div>
                <div className="text-xs text-muted-foreground">{k.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Scans over time */}
      <Section
        icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
        title="Scans Over Time"
        badge={
          <span className="text-xs text-muted-foreground">
            {timeRange === "7d"
              ? "Last 7 days"
              : timeRange === "30d"
                ? "Last 30 days"
                : "Last 90 days"}
          </span>
        }
        loading={loading}
        height={180}
        empty={scansSeries.length === 0}
        emptyIcon={<TrendingUp className="w-6 h-6" />}
        emptyText="No scan data in this period"
      >
        <ReactECharts
          option={scansLineOpt}
          style={{ height: 180 }}
          opts={{ renderer: "svg" }}
        />
      </Section>

      {/* Drop-offs + Visitor mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section
            icon={<ArrowDownRight className="w-4 h-4 text-red-400" />}
            title="Drop-off by Step"
            badge={
              <span className="text-xs text-muted-foreground">
                {dropOffs.length} steps
              </span>
            }
            loading={loading}
            
            height={Math.max(180, dropOffs.length * 36 + 16)}
            empty={dropOffs.length === 0}
            emptyIcon={<Activity className="w-6 h-6" />}
            emptyText="No drop-offs detected"
          >
            <ReactECharts
              option={dropOffOpt}
              style={{ height: Math.max(180, dropOffs.length * 36 + 16) }}
              opts={{ renderer: "svg" }}
            />
          </Section>
        </div>

        <Section
          icon={<Repeat className="w-4 h-4 text-muted-foreground" />}
          title="Visitor Mix"
          loading={loading}
          height={220}
          empty={kpis.totalScans === 0}
          emptyText="No visitor data"
        >
          <div className="relative">
            <ReactECharts
              option={donutOpt}
              style={{ height: 180 }}
              opts={{ renderer: "svg" }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {(100 - kpis.repeatPct).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Unique</div>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-5 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{" "}
              Unique
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />{" "}
              Repeat
            </div>
          </div>
        </Section>
      </div>

      {/* Peak times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          icon={<Clock className="w-4 h-4 text-muted-foreground" />}
          title="Peak Hours"
          badge={
            peakHourLabel && !loading ? (
              <span className="text-xs text-amber-400 font-medium">
                Peak: {peakHourLabel}
              </span>
            ) : undefined
          }
          loading={loading}
          height={160}
          empty={false}
        >
          <ReactECharts
            option={peakHoursOpt}
            style={{ height: 160 }}
            opts={{ renderer: "svg" }}
          />
        </Section>

        <Section
          icon={<CalendarDays className="w-4 h-4 text-muted-foreground" />}
          title="Peak Days"
          badge={
            peakDayLabel && !loading ? (
              <span className="text-xs text-indigo-400 font-medium">
                Busiest: {peakDayLabel}
              </span>
            ) : undefined
          }
          loading={loading}
          height={160}
          empty={false}
        >
          <ReactECharts
            option={peakDaysOpt}
            style={{ height: 160 }}
            opts={{ renderer: "svg" }}
          />
        </Section>
      </div>

      {/* Bottom 3 lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Most saved items */}
        <Section
          icon={<Heart className="w-4 h-4 text-pink-400" />}
          title="Most Saved Items"
          loading={loading}
          height={200}
          empty={saved.length === 0}
          emptyText="No saved items yet"
        >
          <div className="space-y-3">
            {saved.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground/40 font-mono w-3 shrink-0">
                  {i + 1}
                </span>
                {item.img ? (
                  <img
                    src={item.img}
                    alt={item.name}
                    className="w-9 h-9 rounded-xl object-cover border border-border/60 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4 text-muted-foreground/30" />
                  </div>
                )}
                <span className="font-medium text-foreground truncate flex-1">
                  {item.name}
                </span>
                <span className="shrink-0 text-xs font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Most clicked links */}
        {/* <Section
          icon={<Link2 className="w-4 h-4 text-blue-400" />}
          title="Most Clicked Links"
          loading={loading}
          height={200}
          empty={links.length === 0}
          emptyText="No link clicks recorded"
        >
          <div className="space-y-3">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground/40 font-mono w-3 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {l.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {l.url.replace(/^https?:\/\//, "")}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                  {l.count}
                </span>
              </div>
            ))}
          </div>
        </Section> */}

        {/* Top responses */}
        <Section
          icon={<MessageSquare className="w-4 h-4 text-violet-400" />}
          title="Top Responses"
          loading={loading}
          height={200}
          empty={topResps.length === 0}
          emptyText="No responses yet"
        >
          <div className="space-y-2.5">
            {topResps.map((r, i) => (
              <div
                key={i}
                className="flex flex-col gap-0.5 text-sm pb-2.5 border-b border-border/40 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground truncate">
                    {r.answer}
                  </span>
                  <span className="shrink-0 text-xs font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                    {r.count}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  Q: {r.question}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
