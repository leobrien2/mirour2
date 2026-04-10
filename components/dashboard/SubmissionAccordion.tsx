import { DashboardForm } from "@/types/dashboard";
import {
  Gift,
  ChevronDown,
  List,
  Database,
  Clock,
  Monitor,
  Globe,
  CheckCircle2,
  Circle,
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
  // 1. Deep check form schema (handles both flat arrays and nested steps/blocks)
  const qs = formSchema?.questions as any;
  if (qs) {
    let allBlocks: any[] = [];
    if (Array.isArray(qs)) {
      qs.forEach((item) => {
        if (item.blocks) allBlocks.push(...item.blocks);
        else allBlocks.push(item);
      });
    } else if (qs.steps) {
      qs.steps.forEach((step: any) => {
        if (step.blocks) allBlocks.push(...step.blocks);
      });
    }

    const node = allBlocks.find((q: any) => q.id === nodeId);
    if (node) {
      const schemaLabel = node.label || node.header || node.title;
      if (schemaLabel && schemaLabel.trim() !== "" && schemaLabel !== nodeId) {
        return schemaLabel;
      }
    }
  }

  // 2. Static map for known system nodes
  if (NODE_LABEL_MAP[nodeId]) return NODE_LABEL_MAP[nodeId];

  // 3. Prettify fallback: "node-rec" → "Rec", "node-dietary-pref" → "Dietary Pref"
  if (nodeId.includes("-") || nodeId.includes("_")) {
    return nodeId
      .replace(/^node-/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return nodeId;
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

  // Reliably fetch the labels using our robust helper function
  const formattedAnswers = Object.entries(actualAnswers).map(
    ([nodeId, val]) => {
      const label = getNodeLabel(nodeId, formSchema);
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
        </div>
      )}
    </div>
  );
}
