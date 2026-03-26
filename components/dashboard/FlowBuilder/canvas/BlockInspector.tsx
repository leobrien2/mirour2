// components/canvas/BlockInspector.tsx
"use client";

import { useState, useMemo, useEffect } from "react";

import {
  Trash2,
  Plus,
  GripVertical,
  X,
  Tag,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  ArrowRight,
  ShoppingBag,
  Star,
  ThumbsUp,
  ThumbsDown,
  Search,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Loader2,
  Asterisk,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  CanvasBlock,
  BlockData,
  TextAlign,
  ButtonVariant,
  AspectRatio,
  CarouselItem,
  SelectOption,
  PinnedProduct,
  CanvasStep,
  BlockType,
} from "@/types/canvas";

type ExtractBlockData<T extends BlockType> = Extract<BlockData, { type: T }>;
import { useStores } from "@/hooks/useStores";

// ── Ultra-Compact UI Primitives (Optimized for 300px width) ───────────────────

const labelCls =
  "flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5";

const inputCls =
  "w-full px-2 py-1.5 h-8 rounded border border-border/60 bg-background text-xs text-foreground shadow-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-all";

const sectionCls =
  "space-y-3 py-4 border-b border-border/40 last:border-0 last:pb-0";

function Field({
  label,
  children,
  action,
  helperText,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  helperText?: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        {action && <div className="mb-1.5">{action}</div>}
      </div>
      {children}
      {helperText && (
        <p className="mt-1 text-[9px] text-muted-foreground/60 leading-tight">
          {helperText}
        </p>
      )}
    </div>
  );
}

// ── Segmented Control (Wraps if necessary, ultra-compact) ─────────────────────

function SegmentedControl<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { label: React.ReactNode; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap p-0.5 bg-muted/40 rounded border border-border/40">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`flex-1 flex items-center justify-center gap-1 min-w-fit py-1 px-1.5 text-[11px] font-medium rounded transition-all duration-200 ${
              isActive
                ? "bg-background text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Toggle — Micro sizing ─────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30
        ${value ? "bg-primary" : "bg-muted-foreground/20"}`}
    >
      <span
        className={`pointer-events-none inline-block h-3 w-3 transform rounded bg-white shadow-sm
          ring-0 transition duration-200 ease-in-out
          ${value ? "translate-x-3" : "translate-x-0"}`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-2 rounded border border-border/40 bg-muted/5 gap-2">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-foreground/80 truncate">
          {label}
        </span>
        {description && (
          <span className="text-[9px] text-muted-foreground/60 mt-0.5 truncate">
            {description}
          </span>
        )}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function AlignButtons({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (v: TextAlign) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      options={[
        { label: <AlignLeft className="w-3.5 h-3.5" />, value: "left" },
        { label: <AlignCenter className="w-3.5 h-3.5" />, value: "center" },
        { label: <AlignRight className="w-3.5 h-3.5" />, value: "right" },
      ]}
    />
  );
}

function ColorField({
  label,
  value,
  onChange,
  defaultValue = "#6366f1",
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  defaultValue?: string;
}) {
  const isAuto = !value;
  return (
    <Field label={label}>
      {isAuto ? (
        <div className="flex items-center justify-between p-1.5 rounded border border-border/60 bg-muted/10 h-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-dashed border-border bg-muted flex items-center justify-center shrink-0">
              <span className="text-[7px] font-bold text-muted-foreground/50 uppercase">
                Auto
              </span>
            </div>
            <span className="text-[11px] text-foreground/80">
              Theme Default
            </span>
          </div>
          <button
            onClick={() => onChange(defaultValue)}
            className="text-[10px] font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded px-2 py-1 transition-all"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="relative shrink-0 w-8 h-8 rounded overflow-hidden border border-border/60 shadow-sm">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute -inset-2 w-12 h-12 cursor-pointer"
            />
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls + " font-mono uppercase text-[11px]"}
            placeholder="#000000"
            maxLength={7}
          />
          <button
            onClick={() => onChange("")}
            title="Reset to auto"
            className="w-8 h-8 flex items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </Field>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className={labelCls + " mb-0"}>{label}</label>
        <span className="text-[10px] font-mono font-medium text-foreground/80 bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1 bg-muted rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  );
}

function StepSelect({
  value,
  onChange,
  steps,
  placeholder = "Select step...",
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  steps: { id: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={inputCls + " appearance-none pr-7"}
      >
        <option value="">{placeholder}</option>
        {steps.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
    </div>
  );
}

// ── DbTagSelector (Compact) ───────────────────────────────────────────────────

function DbTagSelector({
  storeId,
  selectedTagIds,
  onChange,
}: {
  storeId?: string;
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const { tags } = useStores();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const storeTags = useMemo(
    () => (storeId ? tags.filter((t) => t.store_id === storeId) : tags),
    [tags, storeId],
  );

  const filtered = useMemo(
    () =>
      storeTags.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [storeTags, search],
  );

  const selectedTags = useMemo(
    () => tags.filter((t) => selectedTagIds.includes(t.id)),
    [tags, selectedTagIds],
  );

  const toggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="rounded border border-border/60 bg-muted/5 p-1.5 space-y-1.5 shadow-sm">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-medium text-primary"
            >
              {t.name}
              <button
                onClick={() => toggle(t.id)}
                className="hover:bg-primary/20 rounded-sm p-0.5 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex items-center gap-1.5 px-2 py-1 h-7 rounded border border-border bg-background shadow-sm focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary">
          <Search className="w-3 h-3 text-muted-foreground/40 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              storeTags.length === 0 ? "No tags..." : "Search tags..."
            }
            className="flex-1 text-[11px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 min-w-0"
          />
        </div>

        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded border border-border bg-popover shadow-xl py-1">
            {filtered.map((t) => {
              const isSelected = selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    toggle(t.id);
                    setSearch("");
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] hover:bg-muted text-left ${
                    isSelected
                      ? "text-primary font-medium bg-primary/5"
                      : "text-foreground/80"
                  }`}
                >
                  <span className="truncate pr-2">{t.name}</span>
                  {isSelected && (
                    <Check className="w-3 h-3 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {open && (
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        )}
      </div>
    </div>
  );
}

// ── DbProductPicker (Compact) ─────────────────────────────────────────────────

function DbProductPicker({
  storeId,
  pinnedProducts,
  onAdd,
  onRemove,
}: {
  storeId?: string;
  pinnedProducts: PinnedProduct[];
  onAdd: (p: PinnedProduct) => void;
  onRemove: (id: string) => void;
}) {
  const { products } = useStores();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const pinnedIds = new Set(pinnedProducts.map((p) => p.id));

  const storeProducts = useMemo(() => {
    if (!storeId) return products;
    return products.filter(
      (p) => (p.store_ids ?? []).includes(storeId) || p.store_id === storeId,
    );
  }, [products, storeId]);

  const filtered = useMemo(
    () =>
      storeProducts.filter((p) =>
        (p.name ?? p.tags ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [storeProducts, search],
  );

  const handleSelect = (p: any) => {
    if (pinnedIds.has(p.id)) return;
    onAdd({
      id: p.id,
      title: p.name ?? p.title ?? p.id,
      imageUrl: p.image_url ?? p.imageUrl ?? undefined,
      price: p.price != null ? `$${Number(p.price).toFixed(2)}` : undefined,
    });
    setSearch("");
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 h-8 rounded border border-primary/30 bg-primary/5 cursor-text focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary"
          onClick={() => setOpen(true)}
        >
          <Search className="w-3.5 h-3.5 text-primary/50 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search products..."
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-primary/50 min-w-0"
          />
        </div>

        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded border border-border bg-popover shadow-xl py-1">
            {filtered.slice(0, 30).map((p: any) => {
              const isPinned = pinnedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(p)}
                  disabled={isPinned}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted ${
                    isPinned ? "opacity-40 cursor-not-allowed bg-muted/50" : ""
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-muted shrink-0 overflow-hidden flex items-center justify-center border border-border/50">
                    {p.image_url || p.imageUrl ? (
                      <img
                        src={p.image_url || p.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-3 h-3 text-muted-foreground/30" />
                    )}
                  </div>
                  <span className="flex-1 text-[11px] font-medium truncate">
                    {p.name ?? p.title ?? p.id}
                  </span>
                  {isPinned && (
                    <Check className="w-3 h-3 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {open && (
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        )}
      </div>

      {pinnedProducts.length > 0 && (
        <div className="space-y-1.5">
          {pinnedProducts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-1.5 rounded border border-border bg-card shadow-sm group"
            >
              <button className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 shrink-0">
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <div className="w-7 h-7 rounded overflow-hidden bg-muted shrink-0 border border-border/50 flex items-center justify-center">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-3 h-3 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate leading-tight">
                  {p.title || p.id}
                </p>
                {p.price && (
                  <p className="text-[9px] text-muted-foreground/60">
                    {p.price}
                  </p>
                )}
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="p-1 text-muted-foreground/40 hover:text-destructive shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sortable Items (Select & Carousel) ────────────────────────────────────────

function SortableCarouselItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: CarouselItem;
  onUpdate: (patch: Partial<CarouselItem>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded border border-border bg-card shadow-sm overflow-hidden ${isDragging ? "opacity-50 ring-1 ring-primary/30" : ""}`}
    >
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="w-8 h-8 rounded-sm bg-muted shrink-0 border border-border/50 flex items-center justify-center overflow-hidden">
          {item.src ? (
            <img src={item.src} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[8px] text-muted-foreground/50">Img</span>
          )}
        </div>
        <input
          type="url"
          value={item.src}
          onChange={(e) => onUpdate({ src: e.target.value })}
          placeholder="URL..."
          className="flex-1 min-w-0 px-2 py-1 h-7 text-[11px] rounded border border-border/50 bg-background focus:outline-none focus:border-primary"
        />
        <button
          onClick={onRemove}
          className="p-1 text-muted-foreground/40 hover:text-destructive shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SortableSelectOption({
  option,
  onUpdate,
  onRemove,
  steps,
  storeId,
}: {
  option: SelectOption;
  onUpdate: (patch: Partial<SelectOption>) => void;
  onRemove: () => void;
  steps: { id: string; label: string }[];
  storeId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded border border-border bg-card shadow-sm ${isDragging ? "opacity-50 ring-1 ring-primary/30" : ""}`}
    >
      <div className="flex items-center gap-1 p-1.5">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab text-muted-foreground/40 shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <input
          type="text"
          value={option.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Option text..."
          className="flex-1 min-w-0 px-2 py-1 h-7 text-xs rounded border border-border/50 bg-background focus:outline-none focus:border-primary"
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className={`p-1 rounded ${expanded ? "bg-primary/10 text-primary" : "text-muted-foreground/60"}`}
        >
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={onRemove}
          className="p-1 text-muted-foreground/40 hover:text-destructive"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Badges - Wrap gracefully below the input */}
      {(option.tags.length > 0 || option.nextStepId) && !expanded && (
        <div className="flex flex-wrap gap-1 pl-8 pb-1.5 pr-2">
          {option.tags.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[9px] font-semibold text-primary border border-primary/20">
              {option.tags.length} tag{option.tags.length > 1 ? "s" : ""}
            </span>
          )}
          {option.nextStepId && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-semibold text-amber-600 border border-amber-500/20">
              Routed
            </span>
          )}
        </div>
      )}

      {expanded && (
        <div className="px-2 pb-2 pt-1 space-y-2 border-t border-border/40 bg-muted/10">
          <Field label="Route To" helperText="Jump to step if picked.">
            <StepSelect
              value={option.nextStepId}
              onChange={(v) => onUpdate({ nextStepId: v })}
              steps={steps}
              placeholder="Default (Next)"
            />
          </Field>
          <Field label="Tags" helperText="Used by Product blocks.">
            <DbTagSelector
              storeId={storeId}
              selectedTagIds={option.tags}
              onChange={(tagIds) => onUpdate({ tags: tagIds })}
            />
          </Field>
          {/* <Field label="Image URL (Opt)">
            <input
              type="url"
              value={option.imageUrl || ""}
              onChange={(e) =>
                onUpdate({ imageUrl: e.target.value || undefined })
              }
              placeholder="https://..."
              className={inputCls}
            />
          </Field> */}
        </div>
      )}
    </div>
  );
}

// ── Block Editors (Stacked Layouts to fit 300px) ──────────────────────────────

function HeadingEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"h1" | "h2" | "h3">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  return (
    <div className={sectionCls}>
      <Field label="Text">
        <textarea
          value={data.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={2}
          className={inputCls + " h-auto resize-none py-2"}
          placeholder="Heading text..."
        />
      </Field>
      <Field label="Alignment">
        <AlignButtons
          value={data.align}
          onChange={(v) => update({ align: v })}
        />
      </Field>
      <ColorField
        label="Color"
        value={data.color}
        onChange={(v) => update({ color: v || undefined })}
        defaultValue="#1a1625"
      />
    </div>
  );
}

function ParagraphEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"paragraph">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  return (
    <div className={sectionCls}>
      <Field label="Text">
        <textarea
          value={data.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={4}
          className={inputCls + " h-auto resize-none py-2"}
          placeholder="Body text..."
        />
      </Field>
      <Field label="Alignment">
        <AlignButtons
          value={data.align}
          onChange={(v) => update({ align: v })}
        />
      </Field>
      <ColorField
        label="Color"
        value={data.color}
        onChange={(v) => update({ color: v || undefined })}
        defaultValue="#7a7585"
      />
      <SliderField
        label="Size"
        value={data.fontSize ?? 14}
        min={10}
        max={32}
        onChange={(v) => update({ fontSize: v })}
      />
    </div>
  );
}
// ── CropPositionPicker ──────────────────────────────────────────────────────

const CROP_POSITIONS = [
  { label: "↖", value: "0% 0%" },
  { label: "↑", value: "50% 0%" },
  { label: "↗", value: "100% 0%" },
  { label: "←", value: "0% 50%" },
  { label: "·", value: "50% 50%" },
  { label: "→", value: "100% 50%" },
  { label: "↙", value: "0% 100%" },
  { label: "↓", value: "50% 100%" },
  { label: "↘", value: "100% 100%" },
] as const;

function CropPositionPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const current = value ?? "50% 50%";
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        Crop Position
      </label>
      <div
        className="grid grid-cols-3 gap-1 w-24"
        title="Choose the focal point for cropping"
      >
        {CROP_POSITIONS.map(({ label, value: pos }) => (
          <button
            key={pos}
            type="button"
            title={pos}
            onClick={() => onChange(pos)}
            className={`h-7 w-full rounded text-sm font-semibold transition-colors ${
              current === pos
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-muted/80 text-foreground/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"image">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);

  const [imgTab, setImgTab] = useState<"url" | "upload">("url");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ src: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={sectionCls}>
      {/* Tab toggle */}
      <div className="flex items-center gap-0 mb-2 rounded border border-border/60 overflow-hidden bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => setImgTab("url")}
          className={`flex-1 text-[11px] font-medium py-1 rounded transition-colors ${
            imgTab === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Add URL
        </button>
        <button
          type="button"
          onClick={() => setImgTab("upload")}
          className={`flex-1 text-[11px] font-medium py-1 rounded transition-colors ${
            imgTab === "upload"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Upload Image
        </button>
      </div>

      {imgTab === "url" ? (
        <Field label="Image URL">
          <input
            type="url"
            value={data.src?.startsWith("data:") ? "" : (data.src || "")}
            onChange={(e) => update({ src: e.target.value })}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
      ) : (
        <Field label="Upload Image">
          <div className="space-y-2">
            {/* Preview */}
            {data.src && (
              <div className="relative w-full h-24 rounded border border-border/60 overflow-hidden bg-muted/30 flex items-center justify-center">
                <img
                  src={data.src}
                  alt="preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => update({ src: "" })}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 text-muted-foreground hover:text-destructive border border-border/50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {/* Upload button */}
            <label className="flex items-center justify-center gap-1.5 w-full h-8 rounded border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors text-[11px] font-medium text-primary">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
              />
              {data.src ? "Replace image" : "Choose image"}
            </label>
          </div>
        </Field>
      )}
      <Field label="Alt Text">
        <input
          type="text"
          value={data.alt || ""}
          onChange={(e) => update({ alt: e.target.value })}
          placeholder="Description..."
          className={inputCls}
        />
      </Field>
      <Field label="Aspect Ratio">
        <SegmentedControl
          value={data.aspectRatio ?? "auto"}
          onChange={(v) => update({ aspectRatio: v as AspectRatio })}
          options={[
            { label: "16:9", value: "16:9" },
            { label: "4:3", value: "4:3" },
            { label: "1:1", value: "1:1" },
            { label: "Auto", value: "auto" },
          ]}
        />
      </Field>
      <Field label="Object Fit">
        <SegmentedControl
          value={data.fit ?? "cover"}
          onChange={(v) => update({ fit: v as "cover" | "contain" })}
          options={[
            { label: "Cover", value: "cover" },
            { label: "Contain", value: "contain" },
          ]}
        />
      </Field>
      <Field label="Alignment">
        <AlignButtons
          value={data.align ?? "center"}
          onChange={(v) => update({ align: v })}
        />
      </Field>
      <SliderField
        label="Width (%)"
        value={data.width ?? 100}
        min={10}
        max={100}
        onChange={(v) => update({ width: v })}
      />
      <SliderField
        label="Radius"
        value={data.borderRadius ?? 8}
        min={0}
        max={48}
        onChange={(v) => update({ borderRadius: v })}
      />

    </div>
  );
}

function CarouselEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"carousel">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = data.items.findIndex((i) => i.id === active.id);
    const newIdx = data.items.findIndex((i) => i.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1)
      update({ items: arrayMove(data.items, oldIdx, newIdx) });
  };

  return (
    <div className="space-y-4">
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + " mb-0"}>
            Images ({data.items.length})
          </label>
          <button
            onClick={() =>
              update({
                items: [
                  ...data.items,
                  { id: uuidv4(), src: "", alt: "", caption: "" },
                ],
              })
            }
            className="text-[10px] text-primary font-semibold"
          >
            + Add
          </button>
        </div>
        {data.items.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-border/60 rounded text-[10px] text-muted-foreground">
            Empty
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={data.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {data.items.map((item) => (
                  <SortableCarouselItem
                    key={item.id}
                    item={item}
                    onUpdate={(patch) =>
                      update({
                        items: data.items.map((i) =>
                          i.id === item.id ? { ...i, ...patch } : i,
                        ),
                      })
                    }
                    onRemove={() =>
                      update({
                        items: data.items.filter((i) => i.id !== item.id),
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <div className={sectionCls}>
        <Field label="Alignment">
          <AlignButtons
            value={data.align ?? "center"}
            onChange={(v) => update({ align: v })}
          />
        </Field>
        <SliderField
          label="Width (%)"
          value={data.width ?? 100}
          min={10}
          max={100}
          onChange={(v) => update({ width: v })}
        />
        <Field label="Aspect Ratio">
          <SegmentedControl
            value={data.aspectRatio ?? "auto"}
            onChange={(v) => update({ aspectRatio: v as AspectRatio })}
            options={[
              { label: "16:9", value: "16:9" },
              { label: "4:3", value: "4:3" },
              { label: "1:1", value: "1:1" },
              { label: "Auto", value: "auto" },
            ]}
          />
        </Field>
        <div className="space-y-1.5 pt-1">
          <ToggleRow
            label="Show Arrows"
            value={!!data.showArrows}
            onChange={(v) => update({ showArrows: v })}
          />
          <ToggleRow
            label="Show Dots"
            value={!!data.showDots}
            onChange={(v) => update({ showDots: v })}
          />
          <ToggleRow
            label="Auto Play"
            value={!!data.autoPlay}
            onChange={(v) => update({ autoPlay: v })}
          />
        </div>
        {data.aspectRatio !== "auto" && (
          <CropPositionPicker
            value={data.objectPosition}
            onChange={(v) => update({ objectPosition: v })}
          />
        )}
      </div>
    </div>
  );
}

function SelectEditor({
  data,
  onChange,
  steps,
  storeId,
}: {
  data: ExtractBlockData<"select">;
  onChange: (d: BlockData) => void;
  steps: { id: string; label: string }[];
  storeId?: string;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = data.options.findIndex((o) => o.id === active.id);
    const newIdx = data.options.findIndex((o) => o.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1)
      update({ options: arrayMove(data.options, oldIdx, newIdx) });
  };

  return (
    <div className="space-y-4">
      <div className={sectionCls}>
        <Field label="Prompt">
          <input
            type="text"
            value={data.question}
            onChange={(e) => update({ question: e.target.value })}
            placeholder="Question..."
            className={inputCls}
          />
        </Field>
        <Field label="Selection">
          <SegmentedControl
            value={data.selectionMode}
            onChange={(v) => update({ selectionMode: v as "single" | "multi" })}
            options={[
              { label: "Single", value: "single" },
              { label: "Multi", value: "multi" },
            ]}
          />
        </Field>
        <Field label="Layout">
          <SegmentedControl
            value={data.layout}
            onChange={(v) => update({ layout: v as "list" | "grid" })}
            options={[
              { label: "List", value: "list" },
              { label: "Grid", value: "grid" },
            ]}
          />
        </Field>
      </div>

      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls + " mb-0"}>
            Options ({data.options.length})
          </label>
          <button
            onClick={() =>
              update({
                options: [
                  ...data.options,
                  { id: uuidv4(), label: "", tags: [] },
                ],
              })
            }
            className="text-[10px] text-primary font-semibold"
          >
            + Add Option
          </button>
        </div>
        {data.options.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-border/60 rounded text-[10px] text-muted-foreground">
            Empty
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={data.options.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {data.options.map((opt) => (
                  <SortableSelectOption
                    key={opt.id}
                    option={opt}
                    steps={steps}
                    storeId={storeId}
                    onUpdate={(patch) =>
                      update({
                        options: data.options.map((o) =>
                          o.id === opt.id ? { ...o, ...patch } : o,
                        ),
                      })
                    }
                    onRemove={() =>
                      update({
                        options: data.options.filter((o) => o.id !== opt.id),
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function ContactEditor({
  data,
  onChange,
  steps,
}: {
  data: ExtractBlockData<"contact">;
  onChange: (d: BlockData) => void;
  steps?: { id: string; label: string }[];
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  const FIELDS = [
    { key: "firstName", label: "First" },
    { key: "lastName", label: "Last" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className={sectionCls}>
        <Field label="Heading (Opt)">
          <input
            type="text"
            value={data.heading || ""}
            onChange={(e) => update({ heading: e.target.value || undefined })}
            placeholder="Heading..."
            className={inputCls}
          />
        </Field>
        <Field label="Fields">
          <div className="rounded border border-border/60 bg-card overflow-hidden">
            <div className="flex px-2 py-1.5 bg-muted/40 border-b border-border/60">
              <span className="flex-1 text-[9px] font-bold text-muted-foreground uppercase">
                Field
              </span>
              <span
                className="w-10 text-center text-[9px] font-bold text-muted-foreground uppercase"
                title="Show"
              >
                <Eye className="w-3 h-3 mx-auto" />
              </span>
              <span
                className="w-10 text-center text-[9px] font-bold text-muted-foreground uppercase"
                title="Require"
              >
                <Asterisk className="w-3 h-3 mx-auto" />
              </span>
            </div>
            {FIELDS.map(({ key, label }) => {
              const cfg = data.fields[key];
              return (
                <div
                  key={key}
                  className="flex items-center px-2 py-1.5 border-b border-border/30 last:border-0"
                >
                  <span className="flex-1 text-[11px] font-medium text-foreground/80">
                    {label}
                  </span>
                  <div className="w-10 flex justify-center">
                    <Toggle
                      value={cfg.enabled}
                      onChange={(v) =>
                        update({
                          fields: {
                            ...data.fields,
                            [key]: { ...cfg, enabled: v },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="w-10 flex justify-center">
                    <Toggle
                      value={cfg.required && cfg.enabled}
                      onChange={(v) =>
                        update({
                          fields: {
                            ...data.fields,
                            [key]: {
                              ...cfg,
                              required: v,
                              enabled: v ? true : cfg.enabled,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Field>
      </div>
      <div className={sectionCls}>
        <Field label="Submit Label">
          <input
            type="text"
            value={data.submitLabel}
            onChange={(e) => update({ submitLabel: e.target.value })}
            placeholder="Submit"
            className={inputCls}
          />
        </Field>
        <Field label="Submit Route">
          <StepSelect
            value={data.nextStepId}
            onChange={(v) => update({ nextStepId: v })}
            steps={steps ?? []}
          />
        </Field>
      </div>
      <div className={sectionCls}>
        <ToggleRow
          label="Enable Skip"
          value={!!data.showSkip}
          onChange={(v) => update({ showSkip: v })}
        />
        {data.showSkip && (
          <div className="mt-2 space-y-2 p-2 bg-muted/10 rounded border border-border/40">
            <Field label="Skip Label">
              <input
                type="text"
                value={data.skipLabel ?? "Skip"}
                onChange={(e) => update({ skipLabel: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Skip Route">
              <StepSelect
                value={data.skipNextStepId}
                onChange={(v) => update({ skipNextStepId: v })}
                steps={steps ?? []}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

function TextInputEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"text-input">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  return (
    <div className={sectionCls}>
      <Field label="Prompt">
        <input
          type="text"
          value={data.question}
          onChange={(e) => update({ question: e.target.value })}
          placeholder="Question..."
          className={inputCls}
        />
      </Field>
      <Field label="Placeholder">
        <input
          type="text"
          value={data.placeholder || ""}
          onChange={(e) => update({ placeholder: e.target.value || undefined })}
          placeholder="Type here..."
          className={inputCls}
        />
      </Field>
      <Field label="Input Type">
        <SegmentedControl
          value={data.multiline}
          onChange={(v) => update({ multiline: v as boolean })}
          options={[
            { label: "Single Line", value: false },
            { label: "Paragraph", value: true },
          ]}
        />
      </Field>
      
    </div>
  );
}

function RatingEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"rating">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  return (
    <div className={sectionCls}>
      <Field label="Prompt">
        <input
          type="text"
          value={data.question}
          onChange={(e) => update({ question: e.target.value })}
          placeholder="Rate us..."
          className={inputCls}
        />
      </Field>
      <Field label="Type">
        <SegmentedControl
          value={data.ratingType}
          onChange={(v) => update({ ratingType: v as "stars" | "thumbs" })}
          options={[
            { label: "Stars", value: "stars" },
            { label: "Thumbs", value: "thumbs" },
          ]}
        />
      </Field>
      {data.ratingType === "stars" && (
        <>
          <SliderField
            label="Max Stars"
            value={data.maxStars ?? 5}
            min={3}
            max={10}
            onChange={(v) => update({ maxStars: v })}
          />
          <Field label="Low Label">
            <input
              type="text"
              value={data.minLabel || ""}
              onChange={(e) => update({ minLabel: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="High Label">
            <input
              type="text"
              value={data.maxLabel || ""}
              onChange={(e) => update({ maxLabel: e.target.value })}
              className={inputCls}
            />
          </Field>
        </>
      )}
      <ToggleRow
        label="Required"
        value={data.required}
        onChange={(v) => update({ required: v })}
      />
    </div>
  );
}

function ButtonEditor({
  data,
  onChange,
  steps,
}: {
  data: ExtractBlockData<"button">;
  onChange: (d: BlockData) => void;
  steps: { id: string; label: string }[];
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  return (
    <div className={sectionCls}>
      <Field label="Label">
        <input
          type="text"
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label="Action">
        <SegmentedControl
          value={data.action ?? "link"}
          onChange={(v) => update({ action: v as "link" | "next-step" })}
          options={[
            { label: "URL", value: "link" },
            { label: "Route", value: "next-step" },
          ]}
        />
      </Field>
      {(data.action ?? "link") === "link" ? (
        <Field label="URL">
          <input
            type="url"
            value={data.href || ""}
            onChange={(e) => update({ href: e.target.value })}
            className={inputCls}
          />
        </Field>
      ) : (
        <Field label="Route To">
          <StepSelect
            value={data.nextStepId}
            onChange={(v) => update({ nextStepId: v })}
            steps={steps}
          />
        </Field>
      )}
      <Field label="Variant">
        <SegmentedControl
          value={data.variant}
          onChange={(v) => update({ variant: v as ButtonVariant })}
          options={[
            { label: "Fill", value: "filled" },
            { label: "Outline", value: "outline" },
            { label: "Ghost", value: "ghost" },
          ]}
        />
      </Field>
      <Field label="Align">
        <AlignButtons
          value={data.align}
          onChange={(v) => update({ align: v })}
        />
      </Field>
      <ColorField
        label="Bg Color"
        value={data.bgColor}
        onChange={(v) => update({ bgColor: v || undefined })}
        defaultValue="#6366f1"
      />
      <ColorField
        label="Text Color"
        value={data.textColor}
        onChange={(v) => update({ textColor: v || undefined })}
        defaultValue="#ffffff"
      />
      <SliderField
        label="Radius"
        value={data.borderRadius ?? 8}
        min={0}
        max={50}
        onChange={(v) => update({ borderRadius: v })}
      />
      <ToggleRow
        label="Full Width"
        value={!!data.fullWidth}
        onChange={(v) => update({ fullWidth: v })}
      />
    </div>
  );
}

function ProductsEditor({
  data,
  onChange,
  storeId,
  allSteps,
  formId,
}: {
  data: ExtractBlockData<"products">;
  onChange: (d: BlockData) => void;
  storeId?: string;
  allSteps?: CanvasStep[];
  formId?: string;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Collect all Select options with tags mapped across the whole flow ──
  const taggedOptions = useMemo(() => {
    if (!allSteps) return [];
    const result: { id: string; label: string; tags: string[] }[] = [];
    for (const step of allSteps) {
      for (const block of step.blocks ?? []) {
        const bd = block.data as any;
        if (bd?.type === "select") {
          for (const opt of bd.options ?? []) {
            if ((opt.tags?.length ?? 0) > 0 && opt.label?.trim()) {
              result.push({
                id: opt.id,
                label: opt.label,
                tags: opt.tags as string[],
              });
            }
          }
        }
      }
    }
    return result;
  }, [allSteps]);

  // ── Simulation selection state — pre-select first 2 ──
  const [simSelected, setSimSelected] = useState<string[]>(() =>
    taggedOptions.slice(0, 2).map((o) => o.id),
  );

  // Re-sync when user adds/maps tags in the flow
  const optionKey = taggedOptions.map((o) => o.id).join(",");
  useEffect(() => {
    setSimSelected(taggedOptions.slice(0, 2).map((o) => o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey]);

  // Flatten tags from selected options
  const simulatedTags = useMemo(() => {
    const chosen = taggedOptions.filter((o) => simSelected.includes(o.id));
    return [...new Set(chosen.flatMap((o) => o.tags))];
  }, [simSelected, taggedOptions]);

  // ── Fetch products for simulation ──
  const [simProducts, setSimProducts] = useState<any[]>([]);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (data.mode !== "tagged") return;
    if (simulatedTags.length === 0) {
      setSimProducts([]);
      return;
    }
    if (!formId && !storeId) return;
    setSimLoading(true);
    fetch("/api/products/by-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formId: formId ?? storeId,
        tagIds: simulatedTags,
        strategy: data.matchStrategy ?? "any",
        limit: data.resultLimit ?? 15,
      }),
    })
      .then((r) => r.json())
      .then((products) => setSimProducts(products ?? []))
      .catch(() => setSimProducts([]))
      .finally(() => setSimLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    simulatedTags.join(","),
    data.mode,
    data.matchStrategy,
    data.resultLimit,
    formId,
    storeId,
  ]);

  const toggleOption = (id: string) =>
    setSimSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="space-y-4">
      {/* Mode */}
      <div className={sectionCls}>
        <Field label="Mode">
          <SegmentedControl
            value={data.mode}
            onChange={(v) => update({ mode: v as "tagged" | "manual" })}
            options={[
              { label: "Dynamic", value: "tagged" },
              { label: "Manual", value: "manual" },
            ]}
          />
        </Field>
      </div>

      {/* Dynamic mode */}
      {data.mode === "tagged" && (
        <>
          <div className={sectionCls}>
            <Field label="Logic">
              <SegmentedControl
                value={data.matchStrategy ?? "any"}
                onChange={(v) => update({ matchStrategy: v as "any" | "all" })}
                options={[
                  { label: "Any", value: "any" },
                  { label: "All", value: "all" },
                ]}
              />
            </Field>
            <SliderField
              label="Limit"
              value={data.resultLimit ?? 15}
              min={1}
              unit=""
              max={30}
              onChange={(v) => update({ resultLimit: v })}
            />
            <Field label="Empty Msg">
              <input
                type="text"
                value={data.fallbackMessage}
                onChange={(e) => update({ fallbackMessage: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          {/* ── Canvas Preview Simulator ── */}
          <div className={sectionCls}>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-9px font-bold text-muted-foreground50 uppercase tracking-widest">
                Canvas Preview
              </p>
              <span className="text-9px text-muted-foreground30">
                · editor only
              </span>
            </div>

            {taggedOptions.length === 0 ? (
              /* Empty state — no Select blocks with tags exist yet */
              <div className="rounded-lg border border-dashed border-border60 p-3 text-center space-y-1.5">
                <ShoppingBag className="w-4 h-4 text-muted-foreground30 mx-auto" />
                <p className="text-10px text-muted-foreground50 leading-relaxed">
                  Add a{" "}
                  <span className="font-semibold text-foreground60">
                    Selection block
                  </span>{" "}
                  with tags mapped to its options — products will preview here
                  automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-10px text-muted-foreground40 leading-relaxed">
                  Toggle options to simulate what products your customers will
                  see.
                </p>

                {/* Option toggle chips */}
                <div className="flex flex-wrap gap-1.5">
                  {taggedOptions.map((opt) => {
                    const isOn = simSelected.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleOption(opt.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-10px font-semibold border transition-all ${
                          isOn
                            ? "bg-primary10 border-primary40 text-primary"
                            : "bg-muted40 border-border50 text-muted-foreground60 hover:border-primary30 hover:text-foreground"
                        }`}
                      >
                        {isOn && <Check className="w-2.5 h-2.5 shrink-0" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Resolved tag pills — helps user understand what tags are active */}
                {simulatedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {simulatedTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-9px px-1.5 py-0.5 rounded bg-muted60 text-muted-foreground50 font-mono"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Live product list */}
                <div className="rounded-lg border border-border40 bg-muted10 overflow-hidden">
                  {simLoading ? (
                    <div className="flex items-center justify-center gap-2 py-5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground40" />
                      <span className="text-10px text-muted-foreground40">
                        Loading...
                      </span>
                    </div>
                  ) : simProducts.length === 0 ? (
                    <div className="py-5 text-center space-y-1">
                      <ShoppingBag className="w-4 h-4 text-muted-foreground20 mx-auto" />
                      <p className="text-10px text-muted-foreground40">
                        {simSelected.length === 0
                          ? "Select options above to preview"
                          : data.fallbackMessage ||
                            "No products match these tags"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border30 max-h-52 overflow-y-auto custom-scrollbar">
                      {simProducts.map((p: any) => {
                        const title = p.name ?? p.title ?? "Product";
                        const price = p.price ?? null;
                        const img = p.imageurl ?? p.imageUrl ?? null;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 px-2.5 py-2"
                          >
                            <div className="w-8 h-8 rounded-md bg-muted50 shrink-0 overflow-hidden border border-border40 flex items-center justify-center">
                              {img ? (
                                <img
                                  src={img}
                                  alt={title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ShoppingBag className="w-3 h-3 text-muted-foreground30" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-10px font-semibold text-foreground70 truncate">
                                {title}
                              </p>
                              {price !== null && (
                                <p className="text-9px text-muted-foreground50">
                                  ${Number(price).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {simProducts.length > 0 && (
                  <p className="text-9px text-muted-foreground30 text-right">
                    {simProducts.length} product
                    {simProducts.length !== 1 ? "s" : ""} matched
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Manual mode */}
      {data.mode === "manual" && (
        <div className={sectionCls}>
          <label className={labelCls}>
            Products {(data.pinnedProducts ?? []).length}
          </label>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => {
              const { active, over } = e;
              if (!over) return;
              const p = data.pinnedProducts ?? [];
              const o = p.findIndex((x) => x.id === active.id);
              const n = p.findIndex((x) => x.id === over.id);
              if (o !== -1 && n !== -1)
                update({ pinnedProducts: arrayMove(p, o, n) });
            }}
          >
            <SortableContext
              items={(data.pinnedProducts ?? []).map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <DbProductPicker
                storeId={storeId}
                pinnedProducts={data.pinnedProducts ?? []}
                onAdd={(p) =>
                  update({
                    pinnedProducts: [...(data.pinnedProducts ?? []), p],
                  })
                }
                onRemove={(id) =>
                  update({
                    pinnedProducts: (data.pinnedProducts ?? []).filter(
                      (p) => p.id !== id,
                    ),
                  })
                }
              />
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Shared display settings */}
      <div className={sectionCls}>
        <Field label="Heading">
          <input
            type="text"
            value={data.heading}
            onChange={(e) => update({ heading: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Layout">
          <SegmentedControl
            value={data.layout}
            onChange={(v) => update({ layout: v as "grid" | "list" })}
            options={[
              { label: "Grid", value: "grid" },
              { label: "List", value: "list" },
            ]}
          />
        </Field>
        <div className="space-y-1.5 pt-1">
          <ToggleRow
            label="Show Cart Btn"
            value={!!data.showAddToCart}
            onChange={(v) => update({ showAddToCart: v })}
          />
          <ToggleRow
            label="Show Tags"
            value={!!data.showProductTags}
            onChange={(v) => update({ showProductTags: v })}
          />
        </div>
      </div>
    </div>
  );
}

function DividerEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"divider">;
  onChange: (d: BlockData) => void;
}) {
  const update = (patch: object) =>
    onChange({ ...data, ...patch } as BlockData);
  return (
    <div className={sectionCls}>
      <ColorField
        label="Color"
        value={data.color}
        onChange={(v) => update({ color: v || undefined })}
        defaultValue="#e2e8f0"
      />
      <SliderField
        label="Thick"
        value={data.thickness ?? 1}
        min={1}
        max={8}
        onChange={(v) => update({ thickness: v })}
      />
      <Field label="Style">
        <SegmentedControl
          value={data.style ?? "solid"}
          onChange={(v) =>
            update({ style: v as "solid" | "dashed" | "dotted" })
          }
          options={[
            { label: "Solid", value: "solid" },
            { label: "Dash", value: "dashed" },
            { label: "Dot", value: "dotted" },
          ]}
        />
      </Field>
    </div>
  );
}

function SpacerEditor({
  data,
  onChange,
}: {
  data: ExtractBlockData<"spacer">;
  onChange: (d: BlockData) => void;
}) {
  return (
    <div className={sectionCls}>
      <SliderField
        label="Height"
        value={data.height}
        min={8}
        max={300}
        onChange={(v) => onChange({ ...data, height: v })}
      />
    </div>
  );
}

// ── Main Shell ────────────────────────────────────────────────────────────────

const BLOCK_TYPE_LABELS: Record<string, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  paragraph: "Paragraph",
  image: "Image",
  carousel: "Carousel",
  select: "Selection",
  contact: "Lead Form",
  "text-input": "Text Input",
  rating: "Rating",
  button: "Button",
  products: "Products",
  divider: "Divider",
  spacer: "Spacer",
};

export type BlockInspectorProps = {
  block: CanvasBlock;
  onChange: (data: BlockData) => void;
  onDelete: () => void;
  steps?: { id: string; label: string }[];
  storeId?: string;
  allSteps?: CanvasStep[]; // NEW
  formId?: string; // NEW
};

export function BlockInspector({
  block,
  onChange,
  onDelete,
  steps,
  storeId,
  allSteps,
  formId,
}: BlockInspectorProps) {
  const { data } = block;
  const renderEditor = () => {
    switch (data.type) {
      case "h1":
      case "h2":
      case "h3":
        return <HeadingEditor data={data} onChange={onChange} />;
      case "paragraph":
        return <ParagraphEditor data={data} onChange={onChange} />;
      case "image":
        return <ImageEditor data={data} onChange={onChange} />;
      case "carousel":
        return <CarouselEditor data={data} onChange={onChange} />;
      case "select":
        return (
          <SelectEditor
            data={data}
            onChange={onChange}
            steps={steps ?? []} // ← add ?? []
            storeId={storeId}
          />
        );
      case "contact":
        return <ContactEditor data={data} onChange={onChange} steps={steps} />;
      case "text-input":
        return <TextInputEditor data={data} onChange={onChange} />;
      case "rating":
        return <RatingEditor data={data} onChange={onChange} />;
      case "button":
        return (
          <ButtonEditor
            data={data}
            onChange={onChange}
            steps={steps ?? []} // ← add ?? []
          />
        );
      case "products":
        return (
          <ProductsEditor
            data={data}
            onChange={onChange}
            storeId={storeId}
            allSteps={allSteps}
            formId={formId}
          />
        );
      case "divider":
        return <DividerEditor data={data} onChange={onChange} />;
      case "spacer":
        return <SpacerEditor data={data} onChange={onChange} />;
      default:
        return (
          <div className="text-center p-4 text-[10px] text-muted-foreground">
            No properties
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-background w-[300px] border-l border-border/50">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60 bg-card shrink-0">
        <div>
          <h3 className="text-xs font-bold text-foreground">
            {BLOCK_TYPE_LABELS[data.type] ?? data.type}
          </h3>
          <p className="text-[9px] text-muted-foreground">Properties</p>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded bg-muted/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete block"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {renderEditor()}
      </div>
    </div>
  );
}
