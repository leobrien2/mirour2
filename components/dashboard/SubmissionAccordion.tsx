import { DashboardForm } from "@/types/dashboard";
import {
  Gift,
  ChevronDown,
  List,
  Timer,
  Database,
  Clock,
  Monitor,
  Globe,
  CheckCircle2,
  Circle,
  MapPin,
} from "lucide-react";

type SubmissionAccordionProps = {
  submission: any;
  session: any;
  sessionNodes: any[];
  formSchema: DashboardForm | undefined;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
};

function formatSeconds(s: number): string {
  if (!s || s <= 0) return "0s";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const NODE_LABEL_MAP: Record<string, string> = {
  "node-welcome": "Welcome",
  "node-complete": "Done!",
  "node-rec": "Recommendations",
  "node-email": "Email Capture",
  "node-phone": "Phone Capture",
  "node-name": "Name Capture",
};

function getNodeLabel(
  nodeId: string,
  formSchema: DashboardForm | undefined,
): string {
  // 1. Check form schema — only use if it gives a real human label
  if (formSchema?.questions) {
    const node = formSchema.questions.find((q: any) => q.id === nodeId) as any;
    const schemaLabel = node?.label || node?.header || node?.title;

    if (schemaLabel && schemaLabel.trim() !== "" && schemaLabel !== nodeId) {
      return schemaLabel;
    }
  }
  // 2. Static map for known system nodes
  if (NODE_LABEL_MAP[nodeId]) return NODE_LABEL_MAP[nodeId];
  // 3. Prettify: "node-rec" → "Rec", "node-dietary-pref" → "Dietary Pref"
  return nodeId
    .replace(/^node-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}


export function SubmissionAccordion({
  submission,
  session,
  sessionNodes,
  formSchema,
  isExpanded,
  onToggle,
  onCopy,
}: SubmissionAccordionProps) {
  const formatDisplayValue = (answer: any): string => {
    if (answer === undefined || answer === null || answer === "") return "—";
    if (Array.isArray(answer)) return answer.join(", ");
    if (typeof answer === "object") return JSON.stringify(answer, null, 2);
    return String(answer);
  };

  const { _meta, _quizScore, ...actualAnswers } = submission.answers || {};

  const formattedAnswers = Object.entries(actualAnswers).map(
    ([nodeId, val]) => {
      let label = nodeId;
      if (formSchema?.questions) {
        const node = formSchema.questions.find((q: any) => q.id === nodeId);
        if (node) label = node.label || node.header || `Step (${nodeId})`;
      }
      return { id: nodeId, label, value: val };
    },
  );

  const deduplicatedNodes = Object.values(
    sessionNodes.reduce((acc: Record<string, any>, node) => {
      const existing = acc[node.node_id];
      if (
        !existing ||
        (node.time_spent_seconds ?? 0) > (existing.time_spent_seconds ?? 0)
      ) {
        acc[node.node_id] = node;
      }
      return acc;
    }, {}),
  ).sort(
    (a: any, b: any) =>
      new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime(),
  ) as any[];

  const totalSecondsFromNodes = deduplicatedNodes.reduce(
    (sum, n: any) => sum + (n.time_spent_seconds ?? 0),
    0,
  );

  const displayTotalTime =
    session?.total_time_seconds ??
    (totalSecondsFromNodes > 0 ? totalSecondsFromNodes : null);

  const maxNodeTime = Math.max(
    ...deduplicatedNodes.map((n: any) => n.time_spent_seconds ?? 0),
    1,
  );

  // Build session summary cells — only include cells with data
  const summaryItems = [
    submission.redemptionCode
      ? {
          key: "reward",
          icon: <Gift className="w-3.5 h-3.5" />,
          label: "Reward Code",
          primary: submission.redemptionCode,
          badge: submission.perkRedeemed
            ? { text: "✓ Redeemed", cls: "bg-green-500/10 text-green-500" }
            : { text: "Available", cls: "bg-blue-500/10 text-blue-500" },
        }
      : null,
    session?.browser || session?.device_type
      ? {
          key: "device",
          icon: <Monitor className="w-3.5 h-3.5" />,
          label: "Device",
          primary:
            [session?.browser, session?.os].filter(Boolean).join(" · ") || "—",
          secondary: session?.device_type
            ? session.device_type.charAt(0).toUpperCase() +
              session.device_type.slice(1)
            : null,
        }
      : null,
    session?.city || session?.country || _meta?.zone_id
      ? {
          key: "location",
          icon: <Globe className="w-3.5 h-3.5" />,
          label: "Location",
          primary:
            [session?.city, session?.country].filter(Boolean).join(", ") || "—",
          secondary: _meta?.zone_id ? `Zone: ${_meta.zone_id}` : null,
        }
      : null,
    {
      key: "time",
      icon: <Clock className="w-3.5 h-3.5" />,
      label: "Submitted",
      primary: new Date(submission.submittedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      secondary: [
        new Date(submission.submittedAt).toLocaleString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
        displayTotalTime != null
          ? `${formatSeconds(displayTotalTime)} session`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    // Fallback: raw user agent if no session browser info
    !session?.browser && _meta?.user_agent
      ? {
          key: "agent",
          icon: <Monitor className="w-3.5 h-3.5" />,
          label: "Agent",
          primary: _meta.user_agent,
          secondary: null,
        }
      : null,
  ].filter(Boolean) as any[];

  const colCount = summaryItems.length;

  return (
    <div className="border-b border-border last:border-b-0">
      {/* ════════════════════════════════════
          HEADER
      ════════════════════════════════════ */}
      <div
        onClick={onToggle}
        className="px-5 py-4 hover:bg-muted/20 cursor-pointer transition-colors flex items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <List className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors truncate leading-tight">
              {submission.formName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {new Date(submission.submittedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {displayTotalTime != null && (
                <span className="text-sm text-muted-foreground/60">
                  · {formatSeconds(displayTotalTime)} to complete
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {session?.status === "completed" ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
          ) : session?.status ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-semibold">
              <Circle className="w-3.5 h-3.5" /> {session.status}
            </span>
          ) : null}
          {submission.perkRedeemed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-semibold">
              <Gift className="w-3.5 h-3.5" /> Redeemed
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* ════════════════════════════════════
          EXPANDED CONTENT
      ════════════════════════════════════ */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* ── BLOCK 1: Responses ── */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
              <List className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Responses
              </span>
              <span className="ml-auto text-xs text-muted-foreground/50 font-mono">
                {formattedAnswers.length} answer
                {formattedAnswers.length !== 1 ? "s" : ""}
              </span>
            </div>
            {formattedAnswers.length > 0 ? (
              <div className="divide-y divide-border">
                {formattedAnswers.map(({ id, label, value }) => {
                  const displayVal = formatDisplayValue(value);
                  const isLong = displayVal.length > 55;
                  return (
                    <div
                      key={id}
                      className={`px-4 py-3 ${
                        isLong
                          ? "flex flex-col gap-1.5"
                          : "flex items-center justify-between gap-8"
                      }`}
                    >
                      <p className="text-sm text-muted-foreground font-medium shrink-0">
                        {label}
                      </p>
                      <p
                        className={`text-sm font-semibold text-foreground whitespace-pre-wrap break-words ${
                          isLong ? "" : "text-right"
                        }`}
                      >
                        {displayVal}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground italic">
                No answers recorded.
              </p>
            )}
          </div>

          {/* ── BLOCK 2: Step Timing (horizontal strip) ── */}
          {deduplicatedNodes.length > 0 && (
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step Timing
                </span>
                <span className="ml-auto text-xs font-bold font-mono text-foreground">
                  {formatSeconds(totalSecondsFromNodes)} total
                </span>
              </div>
              {/* Horizontally scrollable step columns */}
              <div className="flex divide-x divide-border overflow-x-auto">
                {deduplicatedNodes.map((node: any, i: number) => {
                  const secs = node.time_spent_seconds ?? 0;
                  const pct = Math.round((secs / maxNodeTime) * 100);
                  const isLongest = secs === maxNodeTime && secs > 0;
                  return (
                    <div
                      key={node.id}
                      className={`flex flex-col items-center px-4 py-3 min-w-[96px] flex-1 gap-2 ${
                        node.is_dropoff
                          ? "bg-red-500/5"
                          : isLongest
                            ? "bg-primary/5"
                            : ""
                      }`}
                    >
                      {/* Step number */}
                      <span className="text-[10px] font-mono text-muted-foreground/40">
                        {i + 1}
                      </span>
                      {/* Time value */}
                      <span
                        className={`text-sm font-bold font-mono ${
                          node.is_dropoff ? "text-red-500" : "text-foreground"
                        }`}
                      >
                        {formatSeconds(secs)}
                      </span>
                      {/* Bar */}
                      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            node.is_dropoff ? "bg-red-500/60" : "bg-primary/50"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {/* Label */}
                      <span className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2 min-h-[2rem]">
                        {getNodeLabel(node.node_id, formSchema)}
                      </span>
                      {node.is_dropoff && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                          dropped
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── BLOCK 3: Session Summary ── */}
          {summaryItems.length > 0 && (
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Session Summary
                </span>
              </div>
              <div
                className={`grid divide-border ${
                  colCount === 4
                    ? "grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
                    : colCount === 3
                      ? "grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x"
                      : colCount === 2
                        ? "grid-cols-2 divide-x"
                        : "grid-cols-1"
                }`}
              >
                {summaryItems.map((item: any) => (
                  <div
                    key={item.key}
                    className="px-4 py-3 flex flex-col gap-1 min-w-0"
                  >
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {item.icon}
                      {item.label}
                    </span>
                    {item.key === "reward" ? (
                      <>
                        <span className="text-base font-bold font-mono text-foreground tracking-widest truncate">
                          {item.primary}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-xs font-bold w-fit px-2 py-0.5 rounded-md ${item.badge.cls}`}
                          >
                            {item.badge.text}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-foreground truncate">
                          {item.primary}
                        </span>
                        {item.secondary && (
                          <span className="text-xs text-muted-foreground truncate">
                            {item.secondary}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
