"use client";

import { DashboardForm } from "@/types/dashboard";
import type { CanvasStep } from "@/types/canvas";
import {
  ArrowLeft,
  Search,
  Download,
  Loader2,
  Users,
  Clock,
  CheckCircle,
  TrendingUp,
  BarChart2,
  List,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatInStoreTime } from "@/lib/utils";
import ReactECharts from "echarts-for-react";

// ── Palette — NO CSS vars, ECharts uses Canvas API ───────────────────────────
const C = {
  primary: "#6366f1",
  primary40: "#6366f166",
  primary15: "#6366f126",
  primary08: "#6366f114",
  muted: "#f1f5f9",
  mutedFg: "#94a3b8",
  fg: "#0f172a",
  fgLight: "#64748b",
  border: "#e2e8f0",
  card: "#ffffff",
  green: "#22c55e",
  red: "#f87171",
  amber: "#fbbf24",
  series: ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#94a3b8"],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type AnswerColumn = {
  blockId: string;
  stepLabel: string;
  blockType:
    | "select"
    | "text-input"
    | "rating"
    | "contact-name"
    | "contact-email"
    | "contact-phone";
  label: string;
  options?: { id: string; label: string }[];
};

type FlowResponse = {
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  answers: Record<string, any>;
  submittedAt: string;
  redemptionCode?: string;
};

type FlowSession = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  totalTimeSec?: number;
  deviceType?: string;
  createdAt: string;
};

type TabType = "overview" | "responses";

// ── Column extraction ─────────────────────────────────────────────────────────

function extractAnswerColumns(steps: CanvasStep[]): AnswerColumn[] {
  const cols: AnswerColumn[] = [];
  for (const step of steps) {
    for (const block of step.blocks ?? []) {
      const data = block.data as any;
      const type = data?.type as string | undefined;
      if (!type) continue;
      if (type === "select") {
        cols.push({
          blockId: block.id,
          stepLabel: step.label ?? "",
          blockType: "select",
          label: data.question || step.label || "Question",
          options: (data.options ?? []).map((o: any) => ({
            id: o.id,
            label: o.label ?? o.id,
          })),
        });
      } else if (type === "text-input") {
        cols.push({
          blockId: block.id,
          stepLabel: step.label ?? "",
          blockType: "text-input",
          label: data.question || data.placeholder || step.label || "Text",
        });
      } else if (type === "rating") {
        cols.push({
          blockId: block.id,
          stepLabel: step.label ?? "",
          blockType: "rating",
          label: data.question || step.label || "Rating",
        });
      } else if (type === "contact") {
        const f = data.fields ?? {};
        if (f.firstName?.enabled || f.lastName?.enabled)
          cols.push({
            blockId: `${block.id}_name`,
            stepLabel: step.label ?? "",
            blockType: "contact-name",
            label: "Name",
          });
        if (f.email?.enabled)
          cols.push({
            blockId: `${block.id}_email`,
            stepLabel: step.label ?? "",
            blockType: "contact-email",
            label: "Email",
          });
        if (f.phone?.enabled)
          cols.push({
            blockId: `${block.id}_phone`,
            stepLabel: step.label ?? "",
            blockType: "contact-phone",
            label: "Phone",
          });
      }
    }
  }
  return cols;
}

function resolveAnswerValue(raw: any, col: AnswerColumn): string {
  if (raw === null || raw === undefined) return "—";
  const value = typeof raw === "object" && "value" in raw ? raw.value : raw;
  if (value === null || value === undefined || value === "") return "—";
  if (col.blockType === "select" && col.options) {
    const match = col.options.find((o) => o.id === String(value));
    if (match) return match.label;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 ${accent ? "bg-indigo-600 border-indigo-500 text-white" : "bg-card border-border"}`}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-indigo-200" : "text-muted-foreground"}`}
        >
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? "bg-white/10" : "bg-muted"}`}
        >
          <Icon
            className={`w-4 h-4 ${accent ? "text-white" : "text-muted-foreground"}`}
          />
        </div>
      </div>
      <p
        className={`text-3xl font-bold tracking-tight ${accent ? "text-white" : "text-foreground"}`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-xs mt-1 ${accent ? "text-indigo-200" : "text-muted-foreground"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type ResponsesViewProps = {
  form: DashboardForm;
  onBack: () => void;
  initialSearch?: string;
  onSearchChange?: (search: string) => void;
  onNavigateToUserProfile?: (userId: string) => void;
};

// ── Main ──────────────────────────────────────────────────────────────────────

export function ResponsesView({
  form,
  onBack,
  initialSearch = "",
  onSearchChange,
  onNavigateToUserProfile,
}: ResponsesViewProps) {
  const [tab, setTab] = useState<TabType>("responses");
  const [responses, setResponses] = useState<FlowResponse[]>([]);
  const [sessions, setSessions] = useState<FlowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const searchChangeRef = useRef(onSearchChange);
  useEffect(() => {
    searchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  const steps = useMemo(
    () => (form.questions as unknown as CanvasStep[]) ?? [],
    [form.questions],
  );
  const columns = useMemo(() => extractAnswerColumns(steps), [steps]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: rData } = await (supabase as any)
        .from("responses")
        .select(
          "id, customer_id, customer_name, customer_email, customer_phone, answers, submitted_at, redemption_code",
        )
        .eq("form_id", form.id)
        .order("submitted_at", { ascending: false });

      setResponses(
        (rData ?? []).map((r: any) => ({
          id: r.id,
          customerId: r.customer_id ?? undefined,
          customerName: r.customer_name ?? undefined,
          customerEmail: r.customer_email ?? undefined,
          customerPhone: r.customer_phone ?? undefined,
          answers: (r.answers as Record<string, any>) || {},
          submittedAt: r.submitted_at,
          redemptionCode: r.redemption_code ?? undefined,
        })),
      );

      const { data: sData, error: sError } = await (supabase as any)
        .from("flow_sessions")
        .select("id, status, total_time_seconds, started_at")
        .eq("form_id", form.id)
        .order("started_at", { ascending: false })
        .limit(100);

      console.log("sessions data", sData);
      console.log("sessions error", sError);

      setSessions(
        (sData ?? []).map((s: any) => ({
          id: s.id,
          status: s.status,
          totalTimeSec: s.total_time_seconds ?? undefined,
          deviceType: s.device_type ?? undefined,
          createdAt: s.created_at,
        })),
      );

      setLoading(false);
    };
    load();
  }, [form.id]);

  // ── Search ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    onSearchChange?.(v);
  };

  useEffect(() => {
    return () => {
      if (searchQuery) searchChangeRef.current?.("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredResponses = useMemo(() => {
    if (!searchQuery) return responses;
    const q = searchQuery.toLowerCase();
    return responses.filter(
      (r) =>
        r.customerName?.toLowerCase().includes(q) ||
        r.customerEmail?.toLowerCase().includes(q) ||
        r.customerPhone?.toLowerCase().includes(q) ||
        Object.values(r.answers).some((a) => {
          const v =
            typeof a === "object" && a !== null && "value" in a ? a.value : a;
          return String(v ?? "")
            .toLowerCase()
            .includes(q);
        }),
    );
  }, [responses, searchQuery]);

  // ── Analytics ──────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === "completed").length;
    const rate =
      sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0;
    const timed = sessions.filter((s) => s.totalTimeSec != null);



    console.log("total time");
    console.log(timed.reduce((a, s) => a + (s.totalTimeSec ?? 0), 0));
    const avgTimeInMinutes =
      timed.length > 0
        ? Math.round(
            timed.reduce((a, s) => a + (s.totalTimeSec ?? 0), 0) / timed.length,
          )
        : 0;

        // handle the minuts and seconds
        const avgTime = Math.floor(avgTimeInMinutes / 60);
     
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = responses.filter(
      (r) => r.submittedAt?.slice(0, 10) === today,
    ).length;
    return {
      total: responses.length,
      completionRate: rate,
      avgTime,
      todayCount,
      completedCount: completed,
    };
  }, [responses, sessions]);

  // Daily chart — last 30 days
  const dailyChart = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    for (const r of responses) {
      const day = r.submittedAt?.slice(0, 10);
      if (day && day in map) map[day]++;
    }
    const days = Object.keys(map);
    return { x: days.map((d) => d.slice(5)), y: days.map((d) => map[d]) };
  }, [responses]);

  // Select answer distributions
  const selectCharts = useMemo(() => {
    return columns
      .filter((c) => c.blockType === "select" && (c.options?.length ?? 0) > 0)
      .map((col) => {
        const counts: Record<string, number> = {};
        for (const opt of col.options ?? []) counts[opt.id] = 0;
        for (const r of responses) {
          const raw = r.answers[col.blockId];
          if (!raw) continue;
          const val =
            typeof raw === "object" && "value" in raw
              ? String(raw.value)
              : String(raw);
          if (val in counts) counts[val]++;
        }
        return {
          col,
          labels: (col.options ?? []).map((o) => o.label),
          values: (col.options ?? []).map((o) => counts[o.id] ?? 0),
        };
      })
      .filter((c) => c.values.some((v) => v > 0));
  }, [columns, responses]);

  // Device breakdown
  const deviceData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      const d = s.deviceType || "unknown";
      map[d] = (map[d] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sessions]);

  // Session status
  const sessionStatusData = useMemo(
    () =>
      [
        {
          name: "Completed",
          value: sessions.filter((s) => s.status === "completed").length,
          color: C.green,
        },
        {
          name: "Abandoned",
          value: sessions.filter((s) => s.status === "abandoned").length,
          color: C.red,
        },
        {
          name: "In Progress",
          value: sessions.filter((s) => s.status === "in_progress").length,
          color: C.amber,
        },
      ].filter((d) => d.value > 0),
    [sessions],
  );

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) throw new Error("Missing Supabase URL");
      const res = await fetch(`${url}/functions/v1/export-csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ formId: form.id }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${form.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (e) {
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Shared ECharts config ──────────────────────────────────────────────────

  const tooltipStyle = {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    textStyle: { color: C.fg, fontSize: 12 },
    extraCssText:
      "box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 10px;",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-8xl mx-auto flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-none">
                {form.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {responses.length} responses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {(["overview", "responses"] as TabType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                    tab === t
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "overview" ? (
                    <BarChart2 className="w-3.5 h-3.5" />
                  ) : (
                    <List className="w-3.5 h-3.5" />
                  )}
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || responses.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-40"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Export
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[500px]">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="max-w-8xl mx-auto px-6 py-6">
          {/* ── Overview ── */}
          {tab === "overview" && (
            <div className="space-y-4">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="Total Responses"
                  value={stats.total}
                  accent
                />
                <StatCard
                  icon={CheckCircle}
                  label="Completion Rate"
                  value={`${stats.completionRate}%`}
                  sub={`${stats.completedCount} of ${sessions.length} sessions`}
                />
                <StatCard
                  icon={Clock}
                  label="Avg. Time"
                  value={stats.avgTime > 0 ? `${stats.avgTime}s` : "—"}
                  sub="per session"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Today"
                  value={stats.todayCount}
                  sub="responses today"
                />
              </div>

              {/* Bento row 1 — full width line chart */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Responses over time
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Last 30 days
                  </span>
                </div>
                <ReactECharts
                  notMerge
                  style={{ height: 200 }}
                  option={{
                    animation: true,
                    grid: { top: 12, right: 12, bottom: 28, left: 36 },
                    xAxis: {
                      type: "category",
                      data: dailyChart.x.length > 0 ? dailyChart.x : [""],
                      axisLine: { show: false },
                      axisTick: { show: false },
                      axisLabel: {
                        fontSize: 11,
                        color: C.mutedFg,
                        interval: 6,
                      },
                      boundaryGap: false,
                    },
                    yAxis: {
                      type: "value",
                      minInterval: 1,
                      min: 0,
                      axisLabel: { fontSize: 11, color: C.mutedFg },
                      // splitLine: { lineStyle: { color: C.muted } },
                      // 
                      // remove the grid lines
                      splitLine: { show: false },
                    },
                    series: [
                      {
                        type: "line",
                        data: dailyChart.y.length > 0 ? dailyChart.y : [0],
                        smooth: 0.4,
                        symbol: "none",
                        lineStyle: { width: 2.5, color: C.primary },
                        areaStyle: {
                          color: {
                            type: "linear",
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                              { offset: 0, color: C.primary40 },
                              { offset: 1, color: C.primary08 },
                            ],
                          },
                        },
                      },
                    ],
                    tooltip: { ...tooltipStyle, trigger: "axis" },
                  }}
                />
              </div>

              {/* Bento row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Session funnel — 2/3 width */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-5">
                    Session funnel
                  </h3>
                  <div className="space-y-4">
                    {[
                      {
                        label: "Total Sessions",
                        value: sessions.length,
                        color: C.primary,
                        pct: 100,
                      },
                      {
                        label: "Completed",
                        value: stats.completedCount,
                        color: C.green,
                        pct:
                          sessions.length > 0
                            ? Math.round(
                                (stats.completedCount / sessions.length) * 100,
                              )
                            : 0,
                      },
                      {
                        label: "Abandoned",
                        value: sessions.filter((s) => s.status === "abandoned")
                          .length,
                        color: C.red,
                        pct:
                          sessions.length > 0
                            ? Math.round(
                                (sessions.filter(
                                  (s) => s.status === "abandoned",
                                ).length /
                                  sessions.length) *
                                  100,
                              )
                            : 0,
                      },
                      {
                        label: "In Progress",
                        value: sessions.filter(
                          (s) => s.status === "in_progress",
                        ).length,
                        color: C.amber,
                        pct:
                          sessions.length > 0
                            ? Math.round(
                                (sessions.filter(
                                  (s) => s.status === "in_progress",
                                ).length /
                                  sessions.length) *
                                  100,
                              )
                            : 0,
                      },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">
                            {row.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {row.value}
                            </span>
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {row.pct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${row.pct}%`,
                              backgroundColor: row.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Device pie — 1/3 width */}
                {selectCharts.length > 0 && (
                  <div className="grid  gap-4">
                    {selectCharts.map(({ col, labels, values }) => (
                      <div
                        key={col.blockId}
                        className="bg-card border border-border rounded-2xl p-6"
                      >
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {col.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-4 truncate">
                          {col.stepLabel}
                        </p>
                        <ReactECharts
                          notMerge
                          style={{ height: 180 }}
                          option={{
                            animation: true,
                            grid: {
                              top: 4,
                              right: 48,
                              bottom: 4,
                              left: 8,
                              containLabel: true,
                            },
                            xAxis: {
                              type: "value",
                              minInterval: 1,
                              min: 0,
                              axisLabel: { fontSize: 11, color: C.mutedFg },
                              // splitLine: { lineStyle: { color: C.muted } },
                              splitLine: { show: false },
                            },
                            yAxis: {
                              type: "category",
                              data: labels.length > 0 ? labels : [""],
                              axisLabel: {
                                fontSize: 11,
                                color: C.fgLight,
                                width: 110,
                                overflow: "truncate",
                              },
                              axisLine: { show: false },
                              axisTick: { show: false },
                            },
                            series: [
                              {
                                type: "bar",
                                data: values.length > 0 ? values : [0],
                                barMaxWidth: 20,
                                itemStyle: {
                                  color: C.primary,
                                  borderRadius: [0, 5, 5, 0],
                                },
                                label: {
                                  show: true,
                                  position: "right",
                                  fontSize: 11,
                                  color: C.fgLight,
                                  formatter: (p: any) => String(p.value),
                                },
                              },
                            ],
                            tooltip: {
                              ...tooltipStyle,
                              trigger: "axis",
                              axisPointer: { type: "shadow" },
                            },
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bento row 3 — select question distributions */}
            </div>
          )}

          {/* ── Responses tab ── */}
          {tab === "responses" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone or answer…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {filteredResponses.length} of {responses.length}
              </p>

              {/* Table */}
              <div className="border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/40 min-w-[180px]">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          Submitted
                        </th>
                        {columns
                          .filter(
                            (c) =>
                              ![
                                "contact-name",
                                "contact-email",
                                "contact-phone",
                              ].includes(c.blockType),
                          )
                          .map((col) => (
                            <th
                              key={col.blockId}
                              className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide max-w-[160px]"
                            >
                              <span
                                className="truncate block"
                                title={col.label}
                              >
                                {col.label}
                              </span>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredResponses.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2 + columns.length}
                            className="px-4 py-20 text-center text-sm text-muted-foreground"
                          >
                            {searchQuery
                              ? "No responses match your search"
                              : "No responses yet"}
                          </td>
                        </tr>
                      ) : (
                        filteredResponses.map((r) => (
                          <tr
                            key={r.id}
                            onClick={() =>
                              onNavigateToUserProfile?.(
                                r.customerId ||
                                  r.customerPhone ||
                                  r.customerEmail ||
                                  r.customerName ||
                                  `anon-${r.id}`,
                              )
                            }
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                          >
                            {/* Customer */}
                            <td className="px-4 py-3 sticky left-0 bg-background">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-semibold text-indigo-600">
                                    {(
                                      r.customerName?.[0] ??
                                      r.customerEmail?.[0] ??
                                      "?"
                                    ).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate max-w-[130px]">
                                    {r.customerName || "Anonymous"}
                                  </p>
                                  {r.customerEmail && (
                                    <p className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                                      {r.customerEmail}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Submitted */}
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatInStoreTime(r.submittedAt)}
                            </td>

                            {/* Answers */}
                            {columns
                              .filter(
                                (c) =>
                                  ![
                                    "contact-name",
                                    "contact-email",
                                    "contact-phone",
                                  ].includes(c.blockType),
                              )
                              .map((col) => {
                                const display = resolveAnswerValue(
                                  r.answers[col.blockId],
                                  col,
                                );
                                return (
                                  <td
                                    key={col.blockId}
                                    className="px-4 py-3 max-w-[160px]"
                                  >
                                    {display === "—" ? (
                                      <span className="text-muted-foreground/30 text-xs">
                                        —
                                      </span>
                                    ) : col.blockType === "rating" ? (
                                      <span className="inline-flex items-center gap-1 text-xs">
                                        <span className="font-medium text-foreground">
                                          {display}
                                        </span>
                                        <span className="text-muted-foreground">
                                          / 5
                                        </span>
                                      </span>
                                    ) : (
                                      <span
                                        className="text-xs text-foreground block truncate"
                                        title={display}
                                      >
                                        {display}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
