// lib/flowLogger.ts
// ─── Dev-only flow logger ─────────────────────────────────────────────────────
// All log() calls compile to no-ops in production.
// The DevConsole subscribes to this to show live DB / activity logs.

const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

export type LogLevel = "info" | "db_write" | "db_read" | "nav" | "error" | "warn";

export interface FlowLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  event: string;
  payload?: unknown;
  table?: string; // set for db_write / db_read events
}

type LogSubscriber = (entry: FlowLogEntry) => void;

const MAX_ENTRIES = 200;
let _seq = 0;

class FlowLoggerClass {
  private _entries: FlowLogEntry[] = [];
  private _subscribers: Set<LogSubscriber> = new Set();

  log(event: string, payload?: unknown, level: LogLevel = "info", table?: string) {
    if (!IS_DEV) return;

    const entry: FlowLogEntry = {
      id: `log_${++_seq}`,
      timestamp: new Date().toISOString(),
      level,
      event,
      payload,
      table,
    };

    // Circular buffer — keep last MAX_ENTRIES
    this._entries.push(entry);
    if (this._entries.length > MAX_ENTRIES) {
      this._entries.shift();
    }

    // Pretty-print to browser console
    const color: Record<LogLevel, string> = {
      info:     "#8b9cf4",
      db_write: "#e05e5e",
      db_read:  "#5eb6e0",
      nav:      "#5ee09a",
      error:    "#e07c5e",
      warn:     "#e0c85e",
    };
    const badge = `%c ${level.toUpperCase()} `;
    const style = `background:${color[level]};color:#fff;border-radius:3px;padding:1px 5px;font-weight:700;font-size:11px`;

    if (level === "error") {
      console.error(badge, style, `[FLOW] ${event}`, payload ?? "");
    } else if (level === "warn") {
      console.warn(badge, style, `[FLOW] ${event}`, payload ?? "");
    } else {
      console.log(badge, style, `[FLOW] ${event}`, payload ?? "");
    }

    // Notify subscribers asynchronously — must NOT call setState synchronously
    // during a render (e.g. when flowLog is called inside a useState updater).
    // setTimeout(fn, 0) guarantees the notification fires after React's commit.
    setTimeout(() => this._subscribers.forEach((cb) => cb(entry)), 0);
  }

  /** All stored entries (newest last). */
  get entries(): FlowLogEntry[] {
    return this._entries;
  }

  /** Subscribe to new log entries. Returns an unsubscribe function. */
  subscribe(cb: LogSubscriber): () => void {
    this._subscribers.add(cb);
    return () => this._subscribers.delete(cb);
  }

  /** Clear all stored entries. */
  clear() {
    this._entries = [];
    this._subscribers.forEach((cb) =>
      cb({ id: "clear", timestamp: new Date().toISOString(), level: "info", event: "LOGS_CLEARED" }),
    );
  }
}

export const flowLogger = new FlowLoggerClass();

// Convenience shorthand
export const flowLog = (
  event: string,
  payload?: unknown,
  level: LogLevel = "info",
  table?: string,
) => flowLogger.log(event, payload, level, table);
