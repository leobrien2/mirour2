// components/canvas/FlowPreviewCard.tsx
"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowRight, GitBranch, Layers } from "lucide-react";
import type { CanvasFlow, CanvasStep } from "@/types/canvas";

// ── Step type inference ───────────────────────────────────────────────────────

type StepKind =
  | "intro"
  | "question"
  | "contact"
  | "rating"
  | "text"
  | "outcome";

function inferStepKind(step: CanvasStep): StepKind {
  const blocks = (step.blocks ?? []) as any[];
  if (blocks.some((b) => b.data?.type === "contact")) return "contact";
  if (blocks.some((b) => b.data?.type === "rating")) return "rating";
  if (blocks.some((b) => b.data?.type === "text-input")) return "text";
  if (blocks.some((b) => b.data?.type === "select")) return "question";
  const hasH1 = blocks.some((b) => b.data?.type === "h1");
  const isTerminal = !step.nextStepId;
  if (hasH1 && !isTerminal) return "intro";
  return "outcome";
}

const KIND_META: Record<
  StepKind,
  { icon: string; badge: string; cls: string }
> = {
  intro: {
    icon: "🚀",
    badge: "Intro",
    cls: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  question: {
    icon: "❓",
    badge: "Question",
    cls: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  },
  contact: {
    icon: "👤",
    badge: "Contact",
    cls: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  rating: {
    icon: "⭐",
    badge: "Rating",
    cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  },
  text: {
    icon: "📝",
    badge: "Text",
    cls: "bg-slate-500/10 text-slate-600 border-slate-400/20",
  },
  outcome: {
    icon: "✅",
    badge: "Outcome",
    cls: "bg-green-500/10 text-green-700 border-green-500/20",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSelectOptions(step: CanvasStep): any[] {
  const block = (step.blocks ?? []).find((b: any) => b.data?.type === "select");
  return (block as any)?.data?.options ?? [];
}

function getStepLabel(flow: CanvasFlow, id: string): string {
  return flow.steps.find((s) => s.id === id)?.label ?? id;
}

function countTaggedOptions(step: CanvasStep): number {
  return getSelectOptions(step).filter((o) => o.tags?.length > 0).length;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface FlowPreviewCardProps {
  flow: CanvasFlow;
  tagsSummary?: string;
}

export function FlowPreviewCard({ flow, tagsSummary }: FlowPreviewCardProps) {
  const outcomeCount = useMemo(
    () => flow.steps.filter((s) => inferStepKind(s) === "outcome").length,
    [flow.steps],
  );

  return (
    <div className="rounded-xl border border-border/60 bg-background/90 overflow-hidden shadow-sm text-[11px] w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-border/40">
        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="font-semibold text-foreground truncate flex-1 text-xs">
          {flow.name}
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {flow.steps.length} step{flow.steps.length !== 1 ? "s" : ""}
          {outcomeCount > 0 &&
            ` · ${outcomeCount} outcome${outcomeCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Steps */}
      <div className="px-3 py-2.5 space-y-1">
        {flow.steps.map((step, idx) => {
          const kind = inferStepKind(step);
          const meta = KIND_META[kind];
          const options = kind === "question" ? getSelectOptions(step) : [];
          const branchingOpts = options.filter((o: any) => o.nextStepId);
          const isBranching = branchingOpts.length > 0;
          const taggedCount = countTaggedOptions(step);
          const isLast = idx === flow.steps.length - 1;
          const showConnector = !isLast;

          return (
            <div key={step.id} className="flex flex-col gap-0.5">
              {/* Step row */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1.5 rounded-lg border ${meta.cls}`}
                >
                  <span className="shrink-0 text-[12px] leading-none">
                    {meta.icon}
                  </span>
                  <span className="font-medium truncate flex-1">
                    {step.label}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border ${meta.cls} opacity-70`}
                  >
                    {meta.badge}
                  </span>
                  {taggedCount > 0 && (
                    <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      🏷 {taggedCount}
                    </span>
                  )}
                  {isBranching && (
                    <GitBranch className="w-3 h-3 text-violet-400 shrink-0" />
                  )}
                </div>
              </div>

              {/* Branching option routes */}
              {isBranching && (
                <div className="ml-5 space-y-0.5 py-0.5">
                  {branchingOpts.slice(0, 4).map((opt: any) => (
                    <div
                      key={opt.id}
                      className="flex items-center gap-1 text-muted-foreground"
                    >
                      <span className="text-border/60 text-xs leading-none pl-1">
                        ├─
                      </span>
                      <span className="truncate max-w-[110px] text-[10px]">
                        {opt.label}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5 text-primary/40 shrink-0" />
                      <span className="text-[10px] text-primary/70 truncate max-w-[80px]">
                        {getStepLabel(flow, opt.nextStepId)}
                      </span>
                    </div>
                  ))}
                  {branchingOpts.length > 4 && (
                    <div className="text-[10px] text-muted-foreground/50 pl-5">
                      +{branchingOpts.length - 4} more routes
                    </div>
                  )}
                </div>
              )}

              {/* Vertical connector */}
              {showConnector && !isBranching && (
                <div className="flex items-center pl-3.5">
                  <ArrowDown className="w-2.5 h-2.5 text-border/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tag summary footer */}
      {tagsSummary && (
        <div className="px-3 py-1.5 border-t border-border/30 bg-muted/20 text-[9px] text-muted-foreground flex items-center gap-1">
          <span>🏷</span>
          <span>{tagsSummary}</span>
        </div>
      )}
    </div>
  );
}
