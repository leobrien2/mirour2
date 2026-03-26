"use client";

// components/dev/DevConsole.tsx
// ─── Floating dev console for the customer flow journey ───────────────────────
// Only renders in development (guarded at call site in FlowPlayer).
// Shows live logs, localStorage, sessionStorage, and full DB payloads.

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { flowLogger, type FlowLogEntry, type LogLevel } from "@/lib/flowLogger";
import {
  X,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Trash2,
  Download,
  Search,
  Terminal,
  Database,
  HardDrive,
  Activity,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

type Tab = "activity" | "localstorage" | "sessionstorage" | "db";

const LEVEL_COLORS: Record<LogLevel, { bg: string; text: string; label: string }> = {
  info:     { bg: "#1e2d5a", text: "#8b9cf4", label: "INFO" },
  db_write: { bg: "#3a1a1a", text: "#e05e5e", label: "DB_WRITE" },
  db_read:  { bg: "#0f2233", text: "#5eb6e0", label: "DB_READ" },
  nav:      { bg: "#0f2d1e", text: "#5ee09a", label: "NAV" },
  error:    { bg: "#3a1e1a", text: "#e07c5e", label: "ERROR" },
  warn:     { bg: "#2f2500", text: "#e0c85e", label: "WARN" },
};

function getStorage(type: "local" | "session"): Record<string, string> {
  if (typeof window === "undefined") return {};
  const store = type === "local" ? localStorage : sessionStorage;
  const result: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k) result[k] = store.getItem(k) ?? "";
  }
  return result;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ level }: { level: LogLevel }) {
  const c = LEVEL_COLORS[level];
  return (
    <span
      className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono leading-none"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

function JsonCollapsible({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(data, null, 2);

  if (data === undefined || data === null) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 text-[11px] text-[#5eb6e0] hover:text-[#8bc8f4] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {open ? "hide" : "show"} payload
      </button>
      {open && (
        <pre className="mt-1 text-[10px] leading-relaxed text-[#a0aec0] bg-[#0a0a14] border border-[#1e2a3f] rounded p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
          {json}
        </pre>
      )}
    </div>
  );
}

function LogEntry({ entry }: { entry: FlowLogEntry }) {
  const time = entry.timestamp.split("T")[1]?.split(".")[0] ?? "";
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 border-b border-[#111827] hover:bg-[#0f1724] transition-colors group">
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-[10px] text-[#4b5563] font-mono tabular-nums pt-0.5">
          {time}
        </span>
        <Badge level={entry.level} />
        <span className="flex-1 text-[12px] font-mono text-[#e2e8f0] break-all">
          {entry.event}
        </span>
        <button
          onClick={() =>
            copyToClipboard(
              JSON.stringify({ event: entry.event, payload: entry.payload }, null, 2),
            )
          }
          className="shrink-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 text-[#6b7280] transition-all"
          title="Copy"
        >
          <Clipboard className="w-3 h-3" />
        </button>
      </div>
      {entry.payload !== undefined && <JsonCollapsible data={entry.payload} />}
    </div>
  );
}

function StorageTab({ type }: { type: "local" | "session" }) {
  const [data, setData] = useState<Record<string, string>>({});
  const refresh = useCallback(() => setData(getStorage(type)), [type]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const entries = Object.entries(data);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2a3f] bg-[#080d18]">
        <span className="text-[11px] text-[#4b5563] font-mono">
          {entries.length} key{entries.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={refresh}
          className="text-[11px] text-[#5eb6e0] hover:text-[#8bc8f4] font-mono transition-colors"
        >
          ↻ refresh
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="py-12 text-center text-[#4b5563] text-[12px] font-mono">
            (empty)
          </div>
        ) : (
          entries.map(([k, v]) => {
            let parsed: unknown = v;
            try {
              parsed = JSON.parse(v);
            } catch {}
            return (
              <div
                key={k}
                className="flex flex-col gap-1 px-3 py-2.5 border-b border-[#111827] hover:bg-[#0f1724] transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-[#5ee09a] break-all flex-1">
                    {k}
                  </span>
                  <button
                    onClick={() => copyToClipboard(v)}
                    className="shrink-0 opacity-0 group-hover:opacity-50 hover:!opacity-100 text-[#6b7280] transition-all"
                    title="Copy value"
                  >
                    <Clipboard className="w-3 h-3" />
                  </button>
                </div>
                {typeof parsed === "object" && parsed !== null ? (
                  <JsonCollapsible data={parsed} />
                ) : (
                  <span className="text-[11px] font-mono text-[#a0aec0] break-all">
                    {String(parsed)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DbTab({ entries }: { entries: FlowLogEntry[] }) {
  const dbEntries = entries.filter((e) => e.level === "db_write" || e.level === "db_read");

  // Group by table
  const grouped: Record<string, FlowLogEntry[]> = {};
  for (const e of dbEntries) {
    const key = e.table ?? e.event.split(" ")[2] ?? "misc";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  if (dbEntries.length === 0) {
    return (
      <div className="py-12 text-center text-[#4b5563] text-[12px] font-mono">
        No DB operations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {Object.entries(grouped).map(([table, rows]) => (
        <div key={table} className="mb-1">
          <div className="sticky top-0 px-3 py-1.5 bg-[#080d18] border-b border-[#1e2a3f] z-10">
            <span className="text-[11px] font-bold font-mono text-[#e0c85e]">
              {table}
            </span>
            <span className="ml-2 text-[10px] text-[#4b5563] font-mono">
              {rows.length} op{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
          {rows.map((e) => (
            <LogEntry key={e.id} entry={e} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main DevConsole ──────────────────────────────────────────────────────────

export function DevConsole() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("activity");
  const [entries, setEntries] = useState<FlowLogEntry[]>([]);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Subscribe to logger
  useEffect(() => {
    // Seed with existing entries
    setEntries([...flowLogger.entries]);

    const unsub = flowLogger.subscribe((entry) => {
      if (entry.event === "LOGS_CLEARED") {
        setEntries([]);
        return;
      }
      setEntries((prev) => [...prev, entry]);
    });
    return unsub;
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && tab === "activity" && open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, autoScroll, tab, open]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const filteredEntries = search.trim()
    ? entries.filter(
        (e) =>
          e.event.toLowerCase().includes(search.toLowerCase()) ||
          JSON.stringify(e.payload ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flow-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Trigger button ──────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[9999] w-11 h-11 rounded-xl bg-[#0e1421] border border-[#1e2a3f] shadow-lg
          flex items-center justify-center text-[#5eb6e0] hover:bg-[#131d30] hover:border-[#2a3d5e] transition-all
          hover:scale-110 active:scale-95"
        title="Open Dev Console"
      >
        <Terminal className="w-5 h-5" />
        {entries.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#e05e5e] text-white text-[9px] font-bold flex items-center justify-center px-1">
            {entries.length > 99 ? "99+" : entries.length}
          </span>
        )}
      </button>
    );
  }

  // ── Panel ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-[#060b14] text-white"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2a3f] bg-[#080d18] shrink-0">
        <Terminal className="w-4 h-4 text-[#5eb6e0]" />
        <span className="text-[13px] font-bold text-[#e2e8f0]">
          Mirour Dev Console
        </span>
        <span className="text-[10px] text-[#4b5563] font-mono">
          {entries.length} events
        </span>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-4">
          {(
            [
              { id: "activity", icon: Activity, label: "Activity" },
              { id: "localstorage", icon: HardDrive, label: "LocalStorage" },
              { id: "sessionstorage", icon: HardDrive, label: "SessionStorage" },
              { id: "db", icon: Database, label: "DB Ops" },
            ] as { id: Tab; icon: any; label: string }[]
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                tab === id
                  ? "bg-[#1e2a3f] text-[#8bc8f4]"
                  : "text-[#4b5563] hover:text-[#9ca3af] hover:bg-[#111827]"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {id === "db" && (
                <span className="text-[9px] px-1 rounded bg-[#3a1a1a] text-[#e05e5e]">
                  {entries.filter((e) => e.level === "db_write" || e.level === "db_read").length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        {tab === "activity" && (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4b5563]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="filter…"
                className="pl-6 pr-3 py-1.5 bg-[#0d1626] border border-[#1e2a3f] rounded-lg text-[11px] text-[#e2e8f0]
                  placeholder-[#374151] focus:outline-none focus:border-[#2a3d5e] w-36 transition-colors"
              />
            </div>
            <button
              onClick={exportLogs}
              title="Export logs as JSON"
              className="p-1.5 rounded-lg text-[#4b5563] hover:text-[#9ca3af] hover:bg-[#111827] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => flowLogger.clear()}
              title="Clear logs"
              className="p-1.5 rounded-lg text-[#4b5563] hover:text-[#e05e5e] hover:bg-[#111827] transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg text-[#4b5563] hover:text-[#9ca3af] hover:bg-[#111827] transition-all"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden">
        {tab === "activity" && (
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto"
          >
            {filteredEntries.length === 0 ? (
              <div className="py-16 text-center text-[#374151] text-[12px]">
                {search ? "No matching events" : "Waiting for events…"}
              </div>
            ) : (
              filteredEntries.map((e) => <LogEntry key={e.id} entry={e} />)
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {tab === "localstorage" && <StorageTab type="local" />}

        {tab === "sessionstorage" && <StorageTab type="session" />}

        {tab === "db" && <DbTab entries={entries} />}
      </div>

      {/* ── Footer ── */}
      {tab === "activity" && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e2a3f] bg-[#080d18] shrink-0">
          <span className="text-[10px] text-[#374151] font-mono">
            {filteredEntries.length} / {entries.length} events
          </span>
          <button
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className={`text-[10px] font-mono transition-colors ${
              autoScroll ? "text-[#5ee09a]" : "text-[#4b5563] hover:text-[#9ca3af]"
            }`}
          >
            {autoScroll ? "↓ auto-scroll on" : "↓ click to resume"}
          </button>
        </div>
      )}
    </div>
  );
}
