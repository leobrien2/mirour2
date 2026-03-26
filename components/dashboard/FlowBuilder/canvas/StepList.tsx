// components/canvas/StepList.tsx
"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  GripVertical,
  Trash2,
  Layers,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from "uuid";
import type { CanvasStep } from "@/types/canvas";

// ── Step thumbnail (mini block type preview) ──────────────────────────────────

function StepThumbnail({ step }: { step: CanvasStep }) {
  if (step.blocks.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-lg border-2 border-dashed border-border/40
          flex items-center justify-center"
        >
          <Plus className="w-3.5 h-3.5 text-muted-foreground/30" />
        </div>
      </div>
    );
  }

  // Show up to 4 block type pills
  const visible = step.blocks.slice(0, 4);

  const TYPE_COLORS: Record<string, string> = {
    h1: "bg-violet-100 text-violet-600",
    h2: "bg-violet-100 text-violet-600",
    h3: "bg-violet-100 text-violet-600",
    paragraph: "bg-sky-100 text-sky-600",
    image: "bg-emerald-100 text-emerald-600",
    carousel: "bg-emerald-100 text-emerald-600",
    button: "bg-amber-100 text-amber-600",
    divider: "bg-slate-100 text-slate-500",
    spacer: "bg-slate-100 text-slate-500",
  };

  const TYPE_HEIGHTS: Record<string, string> = {
    h1: "h-3",
    h2: "h-2.5",
    h3: "h-2",
    paragraph: "h-1.5",
    image: "h-8",
    carousel: "h-8",
    button: "h-4",
    divider: "h-px",
    spacer: "h-2",
  };

  return (
    <div className="w-full h-full flex flex-col justify-center gap-1 px-2 py-2">
      {visible.map((block) => (
        <div
          key={block.id}
          className={`w-full rounded-sm transition-all
            ${TYPE_COLORS[block.data.type] ?? "bg-muted"}
            ${TYPE_HEIGHTS[block.data.type] ?? "h-2"}
            ${block.data.type === "divider" ? "opacity-40" : "opacity-60"}
          `}
        />
      ))}
      {step.blocks.length > 4 && (
        <p className="text-[8px] text-muted-foreground/40 text-center mt-0.5">
          +{step.blocks.length - 4} more
        </p>
      )}
    </div>
  );
}

// ── Sortable step card ────────────────────────────────────────────────────────

type SortableStepCardProps = {
  step: CanvasStep;
  index: number;
  isSelected: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: (label: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
};

function SortableStepCard({
  step,
  index,
  isSelected,
  isRenaming,
  onSelect,
  onDelete,
  onDuplicate,
  onRename,
  onStartRename,
  onCancelRename,
}: SortableStepCardProps) {
  const [renameValue, setRenameValue] = useState(step.label);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleRenameSubmit = () => {
    onRename(renameValue.trim() || `Step ${index + 1}`);
  };

  return (
    <div ref={setNodeRef} style={style} className="group/step relative">
      <div
        onClick={onSelect}
        className={`relative flex flex-col rounded-xl border cursor-pointer
          transition-all duration-150 overflow-hidden
          ${
            isSelected
              ? "border-primary/50 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] bg-primary/5"
              : "border-border/60 hover:border-border bg-background hover:shadow-sm"
          }`}
      >
        {/* Step number badge */}
        <div
          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full
          flex items-center justify-center text-[9px] font-bold
          ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted/80 text-muted-foreground/60 border border-border/60"
          }`}
        >
          {index + 1}
        </div>

        {/* Actions row (top right) */}
        <div
          className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5
          opacity-0 group-hover/step:opacity-100 transition-opacity"
        >
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground
              hover:bg-background/80 cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical className="w-3 h-3" />
          </button>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground
                  hover:bg-background/80 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename();
                }}
                className="text-xs gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="text-xs gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{step.label}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this step and all its blocks.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground
                        hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Thumbnail */}
        <div
          className={`w-full h-[100px] border-b transition-colors
          ${isSelected ? "border-primary/20 bg-primary/5" : "border-border/40 bg-muted/20"}`}
        >
          <StepThumbnail step={step} />
        </div>

        {/* Label row */}
        <div className="px-2.5 py-2">
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") {
                  setRenameValue(step.label);
                  onCancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs font-medium bg-transparent border-b border-primary
                focus:outline-none text-foreground pb-0.5"
            />
          ) : (
            <p
              className={`text-xs font-medium truncate transition-colors
              ${isSelected ? "text-primary" : "text-foreground/70"}`}
            >
              {step.label}
            </p>
          )}

          {/* Block count */}
          <div className="flex items-center gap-1.5 mt-1">
            <Layers className="w-2.5 h-2.5 text-muted-foreground/30 shrink-0" />
            <span className="text-[10px] text-muted-foreground/40">
              {step.blocks.length === 0
                ? "Empty"
                : `${step.blocks.length} block${step.blocks.length !== 1 ? "s" : ""}`}
            </span>
            {step.blocks.length > 0 && (
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/60 ml-auto shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main StepList ─────────────────────────────────────────────────────────────

type StepListProps = {
  steps: CanvasStep[];
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
  onDuplicateStep: (id: string) => void;
  onRenameStep: (id: string, label: string) => void;
  onReorderSteps: (steps: CanvasStep[]) => void;
  flowName?: string;
};

export function StepList({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onDuplicateStep,
  onRenameStep,
  onReorderSteps,
  flowName,
}: StepListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex((s) => s.id === active.id);
    const newIdx = steps.findIndex((s) => s.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorderSteps(arrayMove(steps, oldIdx, newIdx));
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border w-[200px] shrink-0">
      {/* ── Header ── */}
      <div className="px-3 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold text-muted-foreground/50
              uppercase tracking-widest"
            >
              Steps
            </p>
            {flowName && (
              <p className="text-xs font-semibold text-foreground/70 truncate mt-0.5">
                {flowName}
              </p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
            {steps.length}
          </span>
        </div>
      </div>

      {/* ── Step cards (scrollable) ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 px-2">
            <div
              className="w-10 h-10 rounded-xl border-2 border-dashed border-border/40
              flex items-center justify-center"
            >
              <Layers className="w-4 h-4 text-muted-foreground/30" />
            </div>
            <p className="text-[11px] text-muted-foreground/50 text-center leading-relaxed">
              No steps yet.
              <br />
              Add your first step below.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={steps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {steps.map((step, index) => (
                <SortableStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  isSelected={selectedStepId === step.id}
                  isRenaming={renamingId === step.id}
                  onSelect={() => onSelectStep(step.id)}
                  onDelete={() => onDeleteStep(step.id)}
                  onDuplicate={() => onDuplicateStep(step.id)}
                  onRename={(label) => {
                    onRenameStep(step.id, label);
                    setRenamingId(null);
                  }}
                  onStartRename={() => {
                    onSelectStep(step.id);
                    setRenamingId(step.id);
                  }}
                  onCancelRename={() => setRenamingId(null)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Add step button ── */}
      <div className="p-2 border-t border-border shrink-0">
        <button
          onClick={onAddStep}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3
            rounded-xl border-2 border-dashed border-border/50
            text-xs font-semibold text-muted-foreground/50
            hover:border-primary/40 hover:text-primary hover:bg-primary/5
            transition-all group"
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-current
            flex items-center justify-center transition-transform
            group-hover:scale-110"
          >
            <Plus className="w-3 h-3" />
          </div>
          Add Step
        </button>
      </div>
    </div>
  );
}

// ── Helper: create a new blank step ──────────────────────────────────────────

export function createBlankStep(index: number): CanvasStep {
  return {
    id: uuidv4(),
    label: `Step ${index + 1}`,
    blocks: [],
    createdAt: new Date().toISOString(),
  };
}

// ── Helper: duplicate a step ─────────────────────────────────────────────────

export function duplicateStep(step: CanvasStep, newIndex: number): CanvasStep {
  return {
    ...step,
    id: uuidv4(),
    label: `${step.label} (copy)`,
    blocks: step.blocks.map((block) => ({
      ...block,
      id: uuidv4(),
    })),
    createdAt: new Date().toISOString(),
  };
}
