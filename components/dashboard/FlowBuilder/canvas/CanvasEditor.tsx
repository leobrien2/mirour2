// components/canvas/CanvasEditor.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "uuid";
import { AIChatPanel } from "@/components/dashboard/FlowBuilder/flow/AIChatPanel";
import { Wand2 } from "lucide-react";
import {
  Smartphone,
  Tablet,
  Monitor,
  GripVertical,
  Trash2,
  Plus,
  AlignLeft,
  Image,
  MousePointer2,
  Minus,
  ArrowUpDown,
  GalleryHorizontal,
  Heading1,
  Heading2,
  Heading3,
  Eye,
  Layers,
  ListChecks,
  UserRound,
  MessageSquare,
  Star,
  ShoppingBag,
} from "lucide-react";
import type {
  CanvasBlock,
  CanvasStep,
  CanvasFlow, // ← ADD THIS IMPORT
  BlockData,
  BlockType,
  DeviceView,
} from "@/types/canvas";
import {
  DEVICE_WIDTHS,
  BLOCK_PALETTE,
  createDefaultBlock,
} from "@/types/canvas";
import { BlockRenderer } from "./BlockRenderer";
import { BlockInspector } from "./BlockInspector";
import { FlowPlayer } from "./FlowPlayer";
import { useStores } from "@/hooks/useStores";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Image,
  GalleryHorizontal,
  ListChecks,
  UserRound,
  MessageSquare,
  Star,
  MousePointer2,
  ShoppingBag,
  Minus,
  ArrowUpDown,
};

// ── Device config ─────────────────────────────────────────────────────────────

const DEVICE_CONFIG: Record<
  DeviceView,
  { Icon: React.ElementType; label: string; shortLabel: string }
> = {
  mobile: { Icon: Smartphone, label: "Mobile", shortLabel: "390px" },
  tablet: { Icon: Tablet, label: "Tablet", shortLabel: "768px" },
  desktop: { Icon: Monitor, label: "Desktop", shortLabel: "1280px" },
};

// ── Sortable block row ────────────────────────────────────────────────────────

type SortableBlockRowProps = {
  block: CanvasBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

function SortableBlockRow({
  block,
  isSelected,
  onSelect,
  onDelete,
}: SortableBlockRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/block">
      {/* Floating toolbar */}
      <div
        className={`absolute -top-8 left-0 z-20 flex items-center gap-0.5
          bg-popover border border-border/80 rounded-lg shadow-lg px-1.5 py-1
          backdrop-blur-sm transition-opacity duration-150
          ${isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"}`}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/50
            hover:text-foreground transition-colors rounded"
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-border mx-0.5" />

        <span className="text-[10px] font-medium text-muted-foreground/60 px-1 select-none">
          {block.data.type}
        </span>

        <div className="w-px h-3.5 bg-border mx-0.5" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors rounded"
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Block wrapper */}
      <div
        onClick={onSelect}
        className={`relative rounded-lg transition-all duration-150 cursor-pointer
          ${
            isSelected
              ? "ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]"
              : "ring-1 ring-transparent hover:ring-border/60"
          }`}
      >
        {isSelected && (
          <div
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-6
            bg-primary rounded-full z-10"
          />
        )}
        <BlockRenderer block={block} />
      </div>
    </div>
  );
}

// ── Drag overlay ghost ────────────────────────────────────────────────────────

function DragGhost({ block }: { block: CanvasBlock }) {
  return (
    <div
      className="bg-background border-2 border-primary/40 rounded-lg shadow-2xl
      opacity-90 px-4 py-2 pointer-events-none max-w-[320px]"
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-primary/60" />
        <span className="text-xs font-medium text-foreground/70">
          {block.data.type}
        </span>
      </div>
    </div>
  );
}

// ── Empty canvas state ────────────────────────────────────────────────────────

function EmptyCanvas({
  onAddBlock,
}: {
  onAddBlock: (type: BlockType) => void;
}) {
  const quickAdd: {
    type: BlockType;
    label: string;
    icon: React.ElementType;
  }[] = [
    { type: "h1", label: "Heading", icon: Heading1 },
    { type: "paragraph", label: "Text", icon: AlignLeft },
    { type: "image", label: "Image", icon: Image },
    { type: "select", label: "Select", icon: ListChecks },
    { type: "button", label: "Button", icon: MousePointer2 },
    { type: "products", label: "Products", icon: ShoppingBag },
  ];

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[500px]
      gap-6 select-none px-6"
    >
      <div
        className="w-16 h-16 rounded-2xl border-2 border-dashed border-border
        flex items-center justify-center bg-muted/30"
      >
        <Layers className="w-7 h-7 text-muted-foreground/40" />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-foreground/70">
          Canvas is empty
        </p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Add a block from the left panel or quick-add below
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {quickAdd.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onAddBlock(type)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border
              bg-background hover:border-primary/40 hover:bg-primary/5
              text-xs font-medium text-foreground/60 hover:text-primary transition-all"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bottom quick-add bar config ───────────────────────────────────────────────

const BOTTOM_QUICK_ADD: { type: BlockType; icon: React.ElementType }[] = [
  { type: "h1", icon: Heading1 },
  { type: "paragraph", icon: AlignLeft },
  { type: "image", icon: Image },
  { type: "select", icon: ListChecks },
  { type: "button", icon: MousePointer2 },
  { type: "products", icon: ShoppingBag },
];

// ── Main CanvasEditor ─────────────────────────────────────────────────────────

type CanvasEditorProps = {
  flow?: CanvasFlow; // ← ADD: full flow object (needed by FlowPlayer in preview)
  step: CanvasStep;
  allSteps: CanvasStep[];
  storeId?: string; // ← ADD: active store ID (needed for tag/product pickers + preview)
  onChange: (updated: CanvasStep) => void;
};

export function CanvasEditor({
  flow, // ← destructure
  step,
  allSteps,
  storeId, // ← destructure
  onChange,
}: CanvasEditorProps) {
  const [device, setDevice] = useState<DeviceView>("mobile");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<CanvasBlock | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMount = useRef(true);

  const { products } = useStores();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedBlock =
    step.blocks.find((b) => b.id === selectedBlockId) ?? null;
  const canvasWidth = DEVICE_WIDTHS[device];

  const routingSteps = allSteps
    .filter((s) => s.id !== step.id)
    .map((s) => ({ id: s.id, label: s.label }));

  // ── Block mutations ─────────────────────────────────────────────────────────

  const addBlock = useCallback(
    (type: BlockType) => {
      const newBlock: CanvasBlock = {
        id: uuidv4(),
        data: createDefaultBlock(type),
      };
      onChange({ ...step, blocks: [...step.blocks, newBlock] });
      setSelectedBlockId(newBlock.id);
      setTimeout(() => {
        canvasRef.current?.scrollTo({
          top: canvasRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 50);
    },
    [step, onChange],
  );

  const updateBlock = useCallback(
    (blockId: string, data: BlockData) => {
      onChange({
        ...step,
        blocks: step.blocks.map((b) => (b.id === blockId ? { ...b, data } : b)),
      });
    },
    [step, onChange],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      onChange({
        ...step,
        blocks: step.blocks.filter((b) => b.id !== blockId),
      });
      if (selectedBlockId === blockId) setSelectedBlockId(null);
    },
    [step, onChange, selectedBlockId],
  );

  // ── Drag handlers ───────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const block = step.blocks.find((b) => b.id === event.active.id);
    setActiveBlock(block ?? null);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveBlock(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = step.blocks.findIndex((b) => b.id === active.id);
      const newIdx = step.blocks.findIndex((b) => b.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      onChange({ ...step, blocks: arrayMove(step.blocks, oldIdx, newIdx) });
    },
    [step, onChange],
  );

  const handleCanvasClick = () => setSelectedBlockId(null);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-muted/10 overflow-hidden w-full">
      {/* ── TOP BAR ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5
        bg-background border-b border-border shrink-0 gap-4"
      >
        {/* Step label */}
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          <p className="text-sm font-semibold text-foreground/80 truncate">
            {step.label}
          </p>
          <span className="text-xs text-muted-foreground/40 shrink-0">
            {step.blocks.length} block{step.blocks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Device toggle */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 shrink-0">
          {(
            Object.entries(DEVICE_CONFIG) as [
              DeviceView,
              (typeof DEVICE_CONFIG)[DeviceView],
            ][]
          ).map(([key, { Icon, label, shortLabel }]) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              title={`${label} (${shortLabel})`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                font-medium transition-all duration-200
                ${
                  device === key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground/50 hover:text-foreground"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Preview toggle */}
        <button
          onClick={() => setShowPreview((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
            font-medium border transition-all shrink-0
            ${
              showPreview
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Block palette ── */}
        {!showPreview && (
          <div
            className="w-[188px] shrink-0 border-r border-border bg-background
            overflow-y-auto flex flex-col"
          >
            <div className="p-3 space-y-5">
              {BLOCK_PALETTE.map(({ group, items }) => (
                <div key={group}>
                  <p
                    className="text-[9px] font-bold text-muted-foreground/50
                    uppercase tracking-widest mb-2 px-1"
                  >
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {items.map(({ type, label, description, iconName }) => {
                      const Icon = ICON_MAP[iconName] ?? AlignLeft;
                      return (
                        <button
                          key={type}
                          onClick={() => addBlock(type)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2
                            rounded-lg text-left group transition-all
                            hover:bg-primary/5 hover:border-primary/20
                            border border-transparent"
                        >
                          <div
                            className="w-7 h-7 rounded-md bg-muted/60
                            border border-border flex items-center justify-center
                            shrink-0 group-hover:bg-primary/10
                            group-hover:border-primary/30 transition-all"
                          >
                            <Icon
                              className="w-3.5 h-3.5 text-muted-foreground/60
                              group-hover:text-primary transition-colors"
                            />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-xs font-semibold text-foreground/70
                              group-hover:text-foreground leading-tight transition-colors"
                            >
                              {label}
                            </p>
                            <p
                              className="text-[10px] text-muted-foreground/40
                              leading-tight mt-0.5 truncate"
                            >
                              {description}
                            </p>
                          </div>
                          <Plus
                            className="w-3 h-3 ml-auto text-muted-foreground/20
                            group-hover:text-primary shrink-0 transition-colors"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom tip */}
            <div className="mt-auto p-3 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground/40 text-center leading-relaxed">
                Click any block to add it to the canvas
              </p>
            </div>
          </div>
        )}

        {/* ── CENTER: Canvas ── */}
        <div
          ref={canvasRef}
          className={`flex-1 overflow-auto transition-colors ${
            showPreview ? "bg-muted/20" : "bg-muted/30"
          }`}
        >
          <div
            className={`flex py-10 min-h-full
            ${device === "mobile" ? "justify-center px-4" : "justify-center px-6"}`}
          >
            <div
              style={{
                width: device === "mobile" ? "100%" : canvasWidth,
                maxWidth: device === "mobile" ? 390 : "100%",
                margin: "0 auto",
                transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              {/* Width label — hidden in preview */}
              {!showPreview && (
                <div className="flex items-center justify-center mb-3 gap-2">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">
                    {DEVICE_CONFIG[device].label} — {canvasWidth}px
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}

              {/* The white page canvas */}
              <div
                onClick={handleCanvasClick}
                className={`bg-card min-h-[600px] transition-all duration-300 ${
                  showPreview
                    ? "rounded-none shadow-none"
                    : "rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-border/40"
                }`}
              >
                {step.blocks.length === 0 && !showPreview ? (
                  <EmptyCanvas onAddBlock={addBlock} />
                ) : (
                  <div
                    className={showPreview ? "" : "p-5 sm:p-7"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {showPreview ? (
                      flow ? (
                        <FlowPlayer
                          key={`preview-${flow.id}`} // showPreview in key not needed — component only mounts when showPreview=true
                          flow={flow}
                          formId={flow.id}
                          storeId={storeId}
                          allProducts={products}
                          showBanner={false}
                          allowReset={true}
                          isPreview={true}
                        />
                      ) : (
                        // flow not ready yet — shouldn't normally be visible but safe fallback
                        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                          <p className="text-sm text-muted-foreground/50">
                            Loading preview...
                          </p>
                        </div>
                      )
                    ) : (
                      // ── Edit mode ──────────────────────────────────────────
                      <div className="p-5 sm:p-7">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={step.blocks.map((b) => b.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-5 pt-3">
                              {step.blocks.map((block) => (
                                <SortableBlockRow
                                  key={block.id}
                                  block={block}
                                  isSelected={selectedBlockId === block.id}
                                  onSelect={() => setSelectedBlockId(block.id)}
                                  onDelete={() => deleteBlock(block.id)}
                                />
                              ))}
                            </div>
                          </SortableContext>

                          <DragOverlay dropAnimation={null}>
                            {activeBlock && <DragGhost block={activeBlock} />}
                          </DragOverlay>
                        </DndContext>

                        {/* Bottom quick-add bar */}
                        {step.blocks.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-dashed border-border/40">
                            <div className="flex flex-wrap gap-2 justify-center">
                              {BOTTOM_QUICK_ADD.map(({ type, icon: Icon }) => (
                                <button
                                  key={type}
                                  onClick={() => addBlock(type)}
                                  className="flex items-center gap-1.5 px-3 py-1.5
                                    rounded-full border border-dashed border-border/60
                                    text-[11px] text-muted-foreground/50
                                    hover:border-primary/40 hover:text-primary
                                    hover:bg-primary/5 transition-all"
                                >
                                  <Icon className="w-3 h-3" />
                                  {type}
                                </button>
                              ))}
                              <button
                                onClick={() => setSelectedBlockId(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5
                                  rounded-full border border-dashed border-primary/40
                                  text-[11px] text-primary/60 hover:text-primary
                                  hover:bg-primary/5 transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                More blocks
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom scroll hint — hidden in preview */}
              {!showPreview && (
                <div className="flex items-center justify-center mt-3 gap-2">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] text-muted-foreground/30 font-mono shrink-0">
                    ↕ scroll to see more
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Block inspector ── */}
        <div
          className={`shrink-0 border-l border-border bg-background overflow-hidden
            flex flex-col transition-all duration-300 ease-in-out
            ${selectedBlock && !showPreview ? "w-[300px]" : "w-0 border-0"}`}
        >
          {selectedBlock && !showPreview && (
            <BlockInspector
              block={selectedBlock}
              onChange={(data) => updateBlock(selectedBlock.id, data)}
              onDelete={() => deleteBlock(selectedBlock.id)}
              steps={routingSteps}
              storeId={storeId}
              allSteps={allSteps}
              formId={flow?.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
