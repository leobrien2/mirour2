// components/canvas/PageBuilder.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowLeft,
  Save,
  MoreHorizontal,
  Globe,
  Loader2,
  CheckCheck,
  Wand2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CanvasFlow, CanvasStep } from "@/types/canvas";
import { StepList, createBlankStep, duplicateStep } from "./StepList";
import { CanvasEditor } from "./CanvasEditor";
import { AIChatPanel } from "../flow/AIChatPanel";
import { useToast } from "@/hooks/use-toast";

// ── Save status indicator ─────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium transition-all
        ${
          status === "saving"
            ? "text-muted-foreground"
            : status === "saved"
              ? "text-emerald-600"
              : status === "error"
                ? "text-destructive"
                : ""
        }`}
    >
      {status === "saving" && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCheck className="w-3.5 h-3.5" />
          Saved
        </>
      )}
      {status === "error" && "Failed to save"}
    </div>
  );
}

// ── No step selected state ────────────────────────────────────────────────────

function NoStepSelected({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-5
      bg-muted/10 text-center px-8"
    >
      <div
        className="w-20 h-20 rounded-3xl border-2 border-dashed border-border/50
        flex items-center justify-center bg-background"
      >
        <svg
          className="w-9 h-9 text-muted-foreground/25"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="1.5" />
          <path d="M3 9h18M9 21V9" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div>
        <p className="text-base font-semibold text-foreground/60">
          No step selected
        </p>
        <p className="text-sm text-muted-foreground/50 mt-1 max-w-[280px]">
          Select a step from the left panel to start editing, or create a new
          one.
        </p>
      </div>

      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl
          bg-primary text-primary-foreground text-sm font-semibold
          hover:bg-primary/90 transition-all shadow-sm"
      >
        + Add First Step
      </button>
    </div>
  );
}

// ── Main PageBuilder ──────────────────────────────────────────────────────────

type PageBuilderProps = {
  /** Initial flow data — pass from your DB/server */
  initialFlow?: CanvasFlow;
  /** Called whenever the user saves — auto or manual */
  onSave?: (flow: CanvasFlow) => Promise<void>;
  /** Active store ID — passed through to tag/product pickers */
  storeId?: string;
  /** Called when user clicks Back */
  onBack?: () => void;
};

export function PageBuilder({
  initialFlow,
  onSave,
  storeId,
  onBack,
}: PageBuilderProps) {
  // ── Flow state ──────────────────────────────────────────────────────────────

  const [flow, setFlow] = useState<CanvasFlow>(
    initialFlow ?? {
      id: uuidv4(),
      name: "Untitled Page",
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  );

  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    initialFlow?.steps[0]?.id ?? null,
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(flow.name);

  // ── AI panel state ──────────────────────────────────────────────────────────

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const { toast } = useToast();

  // ── Stable refs ─────────────────────────────────────────────────────────────

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMount = useRef(true);

  // ── Auto-save (debounced, 1.5 s) ────────────────────────────────────────────

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (!onSaveRef.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    setSaveStatus("saving");

    autoSaveTimer.current = setTimeout(async () => {
      try {
        await onSaveRef.current!({
          ...flow,
          updatedAt: new Date().toISOString(),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    }, 1500);
  }, [flow]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedStep = flow.steps.find((s) => s.id === selectedStepId) ?? null;

  // ── Flow mutations ──────────────────────────────────────────────────────────

  const updateFlow = useCallback((patch: Partial<CanvasFlow>) => {
    setFlow((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleAddStep = useCallback(() => {
    const newStep = createBlankStep(flow.steps.length);
    updateFlow({ steps: [...flow.steps, newStep] });
    setSelectedStepId(newStep.id);
  }, [flow.steps, updateFlow]);

  const handleDeleteStep = useCallback(
    (id: string) => {
      const updated = flow.steps.filter((s) => s.id !== id);
      updateFlow({ steps: updated });
      if (selectedStepId === id) {
        const idx = flow.steps.findIndex((s) => s.id === id);
        const next = updated[idx] ?? updated[idx - 1] ?? null;
        setSelectedStepId(next?.id ?? null);
      }
    },
    [flow.steps, selectedStepId, updateFlow],
  );

  const handleDuplicateStep = useCallback(
    (id: string) => {
      const original = flow.steps.find((s) => s.id === id);
      if (!original) return;
      const idx = flow.steps.findIndex((s) => s.id === id);
      const copy = duplicateStep(original, idx + 1);
      const updated = [
        ...flow.steps.slice(0, idx + 1),
        copy,
        ...flow.steps.slice(idx + 1),
      ];
      updateFlow({ steps: updated });
      setSelectedStepId(copy.id);
    },
    [flow.steps, updateFlow],
  );

  const handleRenameStep = useCallback(
    (id: string, label: string) => {
      updateFlow({
        steps: flow.steps.map((s) => (s.id === id ? { ...s, label } : s)),
      });
    },
    [flow.steps, updateFlow],
  );

  const handleReorderSteps = useCallback(
    (reordered: CanvasStep[]) => {
      updateFlow({ steps: reordered });
    },
    [updateFlow],
  );

  const handleStepChange = useCallback(
    (updatedStep: CanvasStep) => {
      updateFlow({
        steps: flow.steps.map((s) =>
          s.id === updatedStep.id ? updatedStep : s,
        ),
      });
    },
    [flow.steps, updateFlow],
  );

  // ── AI: apply generated flow ────────────────────────────────────────────────

  const handleApplyAIFlow = useCallback(
    (generatedFlow: CanvasFlow) => {
      // Preserve the DB row's id and createdAt so saves hit the correct record
      const merged: CanvasFlow = {
        ...generatedFlow,
        id: flow.id,
        createdAt: flow.createdAt,
        updatedAt: new Date().toISOString(),
      };

      setFlow(merged);
      setNameValue(merged.name);

      // Auto-select the first generated step
      const firstStepId = merged.steps[0]?.id ?? null;
      setSelectedStepId(firstStepId);

      toast({
        title: "Flow applied ✨",
        description: `"${generatedFlow.name}" loaded with ${generatedFlow.steps.length} step${generatedFlow.steps.length !== 1 ? "s" : ""}.`,
      });
    },
    [flow.id, flow.createdAt, toast],
  );

  // ── Manual save ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!onSave) return;

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    setSaveStatus("saving");
    try {
      await onSave({ ...flow, updatedAt: new Date().toISOString() });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // ── Flow name rename ────────────────────────────────────────────────────────

  const handleNameSubmit = () => {
    const trimmed = nameValue.trim() || "Untitled Page";
    setNameValue(trimmed);
    updateFlow({ name: trimmed });
    setIsEditingName(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── GLOBAL TOP NAV ── */}
      <header
        className="flex items-center justify-between px-4 py-2.5
        border-b border-border bg-background shrink-0 gap-4 z-30"
      >
        {/* Left: back + flow name */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <>
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm font-medium
                  text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowLeft
                  className="w-4 h-4 transition-transform
                  group-hover:-translate-x-0.5"
                />
                Back
              </button>
              <div className="w-px h-5 bg-border/60 shrink-0" />
            </>
          )}

          {/* Editable flow name */}
          {isEditingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") {
                  setNameValue(flow.name);
                  setIsEditingName(false);
                }
              }}
              className="text-sm font-semibold bg-transparent border-b border-primary
                focus:outline-none text-foreground min-w-[120px] max-w-[280px] pb-0.5"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-foreground/80 hover:text-foreground
                transition-colors truncate max-w-[240px] text-left"
              title="Click to rename"
            >
              {flow.name}
            </button>
          )}

          {/* Step breadcrumb */}
          {selectedStep && (
            <>
              <span className="text-muted-foreground/30 text-sm shrink-0">
                /
              </span>
              <span className="text-sm text-muted-foreground/60 truncate max-w-[160px]">
                {selectedStep.label}
              </span>
            </>
          )}
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save indicator */}
          <SaveIndicator status={saveStatus} />

          {/* ── AI Build button ── */}
          <button
            onClick={() => setAiPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-primary/8 hover:bg-primary/15 border border-primary/25
              text-xs font-semibold text-primary transition-all
              hover:shadow-sm hover:border-primary/40 active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Build
          </button>

          {/* Manual save */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-foreground text-background text-xs font-semibold
                hover:bg-foreground/90 transition-all disabled:opacity-50
                disabled:cursor-not-allowed shadow-sm active:scale-95"
            >
              {saveStatus === "saving" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save
            </button>
          )}

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 rounded-lg border border-border text-muted-foreground/60
                  hover:text-foreground hover:bg-muted/60 transition-all"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => setIsEditingName(true)}
                className="text-xs gap-2"
              >
                <Globe className="w-3.5 h-3.5" />
                Rename flow
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleAddStep}
                onDoubleClick={() => setAiPanelOpen(true)}
                className="text-xs gap-2"
              >
                + Add step
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setAiPanelOpen(true)}
                className="text-xs gap-2"
              >
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary font-medium">AI Build</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── MAIN BODY ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step list sidebar */}
        <StepList
          steps={flow.steps}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onAddStep={handleAddStep}
          onDeleteStep={handleDeleteStep}
          onDuplicateStep={handleDuplicateStep}
          onRenameStep={handleRenameStep}
          onReorderSteps={handleReorderSteps}
          flowName={flow.name}
        />

        {/* Canvas area */}
        <div className="flex-1 flex overflow-hidden">
          {selectedStep ? (
            <CanvasEditor
              flow={flow}
              step={selectedStep}
              allSteps={flow.steps}
              storeId={storeId}
              onChange={handleStepChange}
            />
          ) : (
            <NoStepSelected onAdd={handleAddStep} />
          )}
        </div>
      </div>

      {/* ── AI CHAT PANEL ── */}
      <AIChatPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        onApplyFlow={handleApplyAIFlow}
      />
    </div>
  );
}
