// components/canvas/FlowPlayer.tsx
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { flowLog } from "@/lib/flowLogger";
import { Bookmark, CheckCircle2, Loader2Icon, User } from "lucide-react";
import { useSavedItems } from "@/hooks/useSavedItems";

const DevConsole =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@/components/dev/DevConsole").then((m) => ({
            default: m.DevConsole,
          })),
        { ssr: false },
      )
    : null;

import {
  Star,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ShoppingBag,
  Loader2,
  ArrowRight,
  ExternalLink,
  Eye,
} from "lucide-react";

import type {
  HeadingBlockData,
  ParagraphBlockData,
  ImageBlockData,
  CarouselBlockData,
  SelectBlockData,
  SelectOption,
  ContactBlockData,
  TextInputBlockData,
  RatingBlockData,
  ButtonBlockData,
  ProductsBlockData,
  DividerBlockData,
  SpacerBlockData,
  CanvasFlow,
  CanvasStep,
} from "@/types/canvas";
import {
  useFlowSession,
  type ContactData,
  type FlowSessionActions,
  type FlowSessionState,
} from "@/hooks/useFlowSessions";
import type { Product } from "@/types/mirour";
import { BookmarkButton } from "../flow/BookmarkButton";
import {
  getLocalCustomer,
  LocalCustomerProfile,
  saveCustomerLocally,
} from "@/lib/customerSession";
import { FloatingProfileBar } from "../flow/FloatingProfileBar";
import { CustomerProfileDrawer } from "../flow/CustomerLoginModal";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FlowPlayerProps {
  flow: CanvasFlow;
  formId: string;
  storeId?: string;
  allProducts?: Product[];
  redemptionCode?: string;
  onComplete?: (responseId: string) => void;
  showBanner?: boolean;
  allowReset?: boolean;
  isPreview?: boolean;
}

type Session = FlowSessionState & FlowSessionActions;

// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY BLOCK RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

function HeadingPlayer({ data }: { data: HeadingBlockData }) {
  const Tag = data.type as "h1" | "h2" | "h3";
  const cls =
    data.type === "h1"
      ? "text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
      : data.type === "h2"
        ? "text-xl sm:text-2xl font-bold tracking-tight leading-snug"
        : "text-lg sm:text-xl font-semibold tracking-tight leading-snug";

  return (
    <Tag
      className={`${cls} text-foreground/90`}
      style={{ textAlign: data.align, color: data.color ?? undefined }}
    >
      {data.text}
    </Tag>
  );
}

function ParagraphPlayer({ data }: { data: ParagraphBlockData }) {
  return (
    <p
      className="leading-relaxed text-foreground/70 sm:text-base text-sm font-medium"
      style={{
        textAlign: data.align,
        color: data.color ?? undefined,
        fontSize: data.fontSize ? `${data.fontSize}px` : undefined,
      }}
    >
      {data.text}
    </p>
  );
}

const RATIO_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "4:3": "aspect-[4/3]",
  "3:2": "aspect-[3/2]",
  auto: "aspect-auto",
};

function ImagePlayer({ data }: { data: ImageBlockData }) {
  if (!data.src) return null;

  const alignJustify =
    data.align === "left"
      ? "flex-start"
      : data.align === "right"
        ? "flex-end"
        : "center";
  const isAuto = data.aspectRatio === "auto";
  const aspect = isAuto
    ? ""
    : (RATIO_CLASS[data.aspectRatio ?? "16:9"] ?? "aspect-video");

  return (
    <div className="w-full flex" style={{ justifyContent: alignJustify }}>
      <div
        style={{
          width: `${data.width ?? 100}%`,
          borderRadius: `${data.borderRadius ?? 16}px`,
          overflow: "hidden",
        }}
        className={isAuto ? "" : aspect}
      >
        <img
          src={data.src}
          alt={data.alt ?? ""}
          className={
            isAuto
              ? "w-full h-auto block"
              : `w-full h-full object-${data.fit ?? "cover"}`
          }
          style={{ objectPosition: data.objectPosition ?? "50% 50%" }}
        />
      </div>
    </div>
  );
}

function DividerPlayer({ data }: { data: DividerBlockData }) {
  return (
    <div className="w-full flex items-center justify-center py-4">
      <hr
        className="w-full opacity-60"
        style={{
          borderColor: data.color ?? "hsl(var(--border))",
          borderTopWidth: data.thickness ?? 1,
          borderStyle: data.style ?? "solid",
        }}
      />
    </div>
  );
}

function SpacerPlayer({ data }: { data: SpacerBlockData }) {
  return <div style={{ height: data.height }} aria-hidden="true" />;
}

// ── CarouselPlayer ────────────────────────────────────────────────────────────

function CarouselPlayer({ data }: { data: CarouselBlockData }) {
  const [idx, setIdx] = useState(0);
  const items = data.items ?? [];
  if (items.length === 0) return null;

  const alignJustify =
    data.align === "left"
      ? "flex-start"
      : data.align === "right"
        ? "flex-end"
        : "center";
  const isAuto = data.aspectRatio === "auto";
  const aspect = isAuto
    ? ""
    : (RATIO_CLASS[data.aspectRatio ?? "16:9"] ?? "aspect-video");
  const prev = () => setIdx((i) => (i - 1 + items.length) % items.length);
  const next = () => setIdx((i) => (i + 1) % items.length);

  return (
    <div className="w-full flex" style={{ justifyContent: alignJustify }}>
      <div
        className="relative group"
        style={{ width: `${data.width ?? 100}%` }}
      >
        <div
          className={`w-full overflow-hidden shadow-sm border border-border/20 relative bg-muted/20 ${aspect}`}
          style={{ borderRadius: `${data.borderRadius ?? 16}px` }}
        >
          <img
            key={items[idx].src}
            src={items[idx].src}
            alt={items[idx].alt ?? ""}
            className={
              isAuto
                ? "w-full h-auto block transition-opacity duration-500 ease-in-out"
                : "w-full h-full object-cover transition-opacity duration-500 ease-in-out"
            }
            style={{ objectPosition: data.objectPosition ?? "50% 50%" }}
          />

          {/* Subtle gradient overlay for better arrow visibility */}
          {data.showArrows && items.length > 1 && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 pointer-events-none" />
          )}
        </div>

        {data.showArrows && items.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                bg-background/80 backdrop-blur-md text-foreground shadow-sm flex items-center justify-center hover:bg-background transition-all opacity-0 group-hover:opacity-100 sm:flex hidden active:scale-95"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                bg-background/80 backdrop-blur-md text-foreground shadow-sm flex items-center justify-center hover:bg-background transition-all opacity-0 group-hover:opacity-100 sm:flex hidden active:scale-95"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {data.showDots && items.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === idx
                    ? "w-6 bg-foreground/80"
                    : "w-1.5 bg-border hover:bg-border/80"
                }`}
              />
            ))}
          </div>
        )}

        {items[idx].caption && (
          <p className="text-sm text-center font-medium text-muted-foreground/70 mt-3">
            {items[idx].caption}
          </p>
        )}
      </div>
    </div>
  );
}

// ── SelectPlayer ──────────────────────────────────────────────────────────────

interface SelectPlayerProps {
  data: SelectBlockData;
  blockId: string;
  onSingleSelect: (opt: SelectOption) => void;
  onMultiSubmit: (optionIds: string[], tags: string[]) => void;
}

function SelectPlayer({
  data,
  onSingleSelect,
  onMultiSubmit,
}: SelectPlayerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isMulti = data.selectionMode === "multi";
  const isGrid = data.layout === "grid";

  const handleMultiToggle = (optId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(optId) ? next.delete(optId) : next.add(optId);
      return next;
    });
  };

  const handleMultiSubmit = () => {
    if (selected.size === 0) return;
    const selectedOpts = data.options.filter((o) => selected.has(o.id));
    const allTags = [...new Set(selectedOpts.flatMap((o) => o.tags))];
    onMultiSubmit([...selected], allTags);
  };

  return (
    <div className="w-full space-y-5">
      {data.question && (
        <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
          {data.question}
        </p>
      )}
      <div className={isGrid ? "grid grid-cols-2 gap-3" : "space-y-3"}>
        {data.options.map((opt) => {
          const isSel = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() =>
                isMulti ? handleMultiToggle(opt.id) : onSingleSelect(opt)
              }
              className={`w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border transition-all duration-200 active:scale-[0.98] group
                ${isGrid ? "flex-col text-center justify-center min-h-[120px]" : "justify-between"}
                ${
                  isSel
                    ? "border-primary bg-primary/5 shadow-[0_4px_14px_rgba(0,0,0,0.03)]"
                    : "border-border/60 bg-card hover:border-primary/30 hover:shadow-sm"
                }`}
            >
              <div
                className={`flex items-center gap-4 ${isGrid ? "flex-col" : "w-full"}`}
              >
                {!isGrid && (
                  <div className="shrink-0">
                    {isMulti ? (
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSel ? "bg-primary border-primary" : "border-muted-foreground/30 bg-background group-hover:border-primary/50"}`}
                      >
                        {isSel && (
                          <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                        )}
                      </div>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                          ${isSel ? "border-primary" : "border-muted-foreground/30 group-hover:border-primary/50"}`}
                      >
                        {isSel && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-in zoom-in-50 duration-200" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {opt.imageUrl && (
                  <img
                    src={opt.imageUrl}
                    alt=""
                    className={`object-cover rounded-xl shrink-0 shadow-sm border border-border/20 ${isGrid ? "w-14 h-14" : "w-10 h-10"}`}
                  />
                )}

                <span
                  className={`font-semibold text-foreground/90 ${
                    isGrid
                      ? "text-sm leading-tight"
                      : "flex-1 text-left text-sm"
                  }`}
                >
                  {opt.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {isMulti && (
        <button
          onClick={handleMultiSubmit}
          disabled={selected.size === 0}
          className="w-full mt-4 py-4 rounded-2xl bg-foreground text-background font-bold text-base hover:bg-foreground/90 hover:shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:hover:shadow-none"
        >
          Continue
        </button>
      )}
    </div>
  );
}

// ── TextInputPlayer ───────────────────────────────────────────────────────────

function TextInputPlayer({
  data,
  onSubmit,
  onChange,
}: {
  data: TextInputBlockData;
  onSubmit: (value: string) => void;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const canSubmit = !data.required || value.trim().length > 0;

  return (
    <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {data.question && (
        <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
          {data.question}
        </p>
      )}
      {data.multiline ? (
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value); // Sync with session immediately
          }}
          placeholder={data.placeholder}
          rows={5}
          className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value); // Sync with session immediately
          }}
          placeholder={data.placeholder}
          onKeyDown={(e) =>
            e.key === "Enter" && canSubmit && onSubmit(value.trim())
          }
          className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
        />
      )}
    </div>
  );
}

// ── RatingPlayer ──────────────────────────────────────────────────────────────

function RatingPlayer({
  data,
  onSubmit,
}: {
  data: RatingBlockData;
  onSubmit: (value: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (value: number) => {
    setSelected(value);
    // Slight delay to let the user see their selection before auto-advancing
    setTimeout(() => onSubmit(value), 300);
  };

  if (data.ratingType === "thumbs") {
    return (
      <div className="w-full space-y-5">
        {data.question && (
          <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug text-center">
            {data.question}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          {[
            {
              value: 1,
              Icon: ThumbsUp,
              label: "Yes",
              active:
                "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm",
            },
            {
              value: 0,
              Icon: ThumbsDown,
              label: "No",
              active: "border-red-500 bg-red-50 text-red-700 shadow-sm",
            },
          ].map(({ value, Icon, label, active }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              className={`flex flex-col items-center justify-center gap-3 w-32 h-32 rounded-3xl border-2
                font-semibold text-base transition-all duration-200 active:scale-95 group
                ${selected === value ? active : "border-border/60 bg-card hover:border-border text-foreground/70"}`}
            >
              <Icon
                className={`w-8 h-8 transition-transform ${selected === value ? "scale-110" : "group-hover:scale-110"}`}
              />
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const max = data.maxStars ?? 5;
  const active = hovered ?? selected ?? 0;

  return (
    <div className="w-full space-y-6">
      {data.question && (
        <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug text-center">
          {data.question}
        </p>
      )}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect(n)}
            className="transition-transform hover:scale-110 active:scale-90 p-1"
          >
            <Star
              className={`w-10 h-10 sm:w-12 sm:h-12 transition-all duration-200 ${
                n <= active
                  ? "fill-amber-400 text-amber-400 drop-shadow-sm scale-110"
                  : "fill-none text-muted-foreground/30 hover:text-muted-foreground/50"
              }`}
            />
          </button>
        ))}
      </div>
      {(data.minLabel || data.maxLabel) && (
        <div className="flex justify-between px-2 text-sm font-medium text-muted-foreground/60">
          <span>{data.minLabel}</span>
          <span>{data.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── ButtonPlayer ──────────────────────────────────────────────────────────────

function ButtonPlayer({
  data,
  onAdvance,
}: {
  data: ButtonBlockData;
  onAdvance: (nextStepId?: string) => void;
}) {
  const variantCls = {
    filled:
      "bg-foreground text-background hover:bg-foreground/90 hover:shadow-lg",
    outline: "border-2 border-border text-foreground hover:bg-muted/50",
    ghost: "text-foreground hover:bg-muted/50",
  }[data.variant];

  const alignCls = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[data.align];

  return (
    <div className={`w-full flex ${alignCls}`}>
      <button
        onClick={() => {
          if (data.action === "link" && data.href) {
            window.open(data.href, "_blank", "noopener,noreferrer");
          } else {
            onAdvance(data.nextStepId);
          }
        }}
        style={{
          backgroundColor:
            data.variant === "filled" && data.bgColor
              ? data.bgColor
              : undefined,
          color: data.textColor ?? undefined,
          borderRadius: `${data.borderRadius ?? 16}px`,
        }}
        className={`flex items-center gap-2.5 px-8 py-4 font-bold text-base
          transition-all duration-200 active:scale-95 ${variantCls}
          ${data.fullWidth ? "w-full justify-center" : ""}`}
      >
        {data.label}

        {/* <ArrowRight className="w-4 h-4" /> */}
      </button>
    </div>
  );
}

// ── ContactBlockPlayer ────────────────────────────────────────────────────────

function ContactBlockPlayer({
  data,
  onSubmit,
  onSkip,
  onAdvance,
  customerId,
  isSubmitting,
  isPreview,
}: {
  data: ContactBlockData;
  onSubmit: (d: ContactData) => Promise<{ error: string | null }>;
  onSkip?: () => void;
  onAdvance?: () => void;
  customerId?: string | null;
  isSubmitting: boolean;
  isPreview?: boolean;
}) {
  const [fields, setFields] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [commitStatus, setCommitStatus] = useState<"idle" | "saving" | "done">(
    "idle",
  );
  const autoSubmittedRef = useRef(false);

  const localCustomer = useMemo(() => getLocalCustomer(), [customerId]);
  const isKnownCustomer = !!customerId && !!localCustomer;

  // ── Known customer — silent commit + auto-advance ─────────────────────────
  useEffect(() => {
    if (!isKnownCustomer) return;
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;

    const silentCommit = async () => {
      setCommitStatus("saving");

      const result = await onSubmit({
        firstName: localCustomer!.firstname ?? undefined,
        lastName:
          localCustomer!.name?.split(" ").slice(1).join(" ") || undefined,
        email: localCustomer!.email ?? undefined,
        phone: localCustomer!.phone ?? undefined,
      });

      if (result.error) {
        console.error(
          "[ContactBlockPlayer] silent commit failed:",
          result.error,
        );
      }

      setCommitStatus("done");

      // Small delay so user sees the ✅ before navigating
      await new Promise((r) => setTimeout(r, 600));
      onAdvance?.();
    };

    silentCommit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKnownCustomer]);

  // ── Known customer — loading screen ──────────────────────────────────────
  if (isKnownCustomer) {
    const displayName =
      localCustomer!.firstname ??
      localCustomer!.name?.split(" ")[0] ??
      localCustomer!.email?.split("@")[0] ??
      "there";

    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 py-12 animate-in fade-in duration-300">
        {/* show loading */}
        <Loader2Icon className="w-8 h-8 animate-spin text-muted-foreground/40 shrink-0" />
        <p className="text-sm text-muted-foreground">Saving your results…</p>
      </div>
    );
  }

  // ── Unknown customer — form UI ────────────────────────────────────────────
  const f = data.fields;
  const set =
    (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async () => {
    setSubmitError(null);

    if (f.firstName.enabled && f.firstName.required && !fields.firstName.trim())
      return setSubmitError("Please enter your first name.");
    if (f.lastName.enabled && f.lastName.required && !fields.lastName.trim())
      return setSubmitError("Please enter your last name.");
    if (f.email.enabled && f.email.required && !fields.email.trim())
      return setSubmitError("Please enter your email address.");
    if (f.phone.enabled && f.phone.required && !fields.phone.trim())
      return setSubmitError("Please enter your phone number.");

    const { error } = await onSubmit({
      firstName: fields.firstName || undefined,
      lastName: fields.lastName || undefined,
      email: fields.email || undefined,
      phone: fields.phone || undefined,
    });

    if (error) {
      setSubmitError(error);
      return;
    }

    onAdvance?.();
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {data.heading && (
        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
          {data.heading}
        </p>
      )}

      {isPreview && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 shadow-sm">
          <Eye className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            Preview mode — your data will not be saved.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {f.firstName.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              First Name {f.firstName.required && "*"}
            </label>
            <input
              type="text"
              placeholder="Jane"
              value={fields.firstName}
              onChange={set("firstName")}
              className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
            />
          </div>
        )}
        {f.lastName.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Last Name {f.lastName.required && "*"}
            </label>
            <input
              type="text"
              placeholder="Doe"
              value={fields.lastName}
              onChange={set("lastName")}
              className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
            />
          </div>
        )}
        {f.email.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Email Address {f.email.required && "*"}
            </label>
            <input
              type="email"
              placeholder="jane@example.com"
              value={fields.email}
              onChange={set("email")}
              className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
            />
          </div>
        )}
        {f.phone.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Phone Number {f.phone.required && "*"}
            </label>
            <input
              type="tel"
              placeholder="(555) 000-0000"
              value={fields.phone}
              onChange={set("phone")}
              className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
            />
          </div>
        )}
      </div>

      {submitError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in shake">
          {submitError}
        </div>
      )}

      <div className="pt-2 space-y-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base hover:bg-foreground/90 hover:shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
          {data.submitLabel || "Continue"}
        </button>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {data.skipLabel ?? "Skip this step"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
interface ProductCardProps {
  product: any;
  compact: boolean;
  showAddToCart?: boolean;
  showTags?: boolean;
  isSaved?: boolean; // NEW
  onToggleSave?: (productId: string) => Promise<void>; // NEW
}

function ProductCard({
  product,
  compact,
  showAddToCart,
  showTags,
  isSaved = false,
  onToggleSave,
}: ProductCardProps) {
  const title = product.name ?? product.title ?? "Product";
  const imageUrl = product.image_url ?? product.image_Url ?? null;
  console.log(imageUrl);
  const price = product.price ?? null;
  const tags = product.tags ?? [];

  console.log(product);

  // ─── COMPACT card ────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="group rounded-2xl border border-border/50 bg-card overflow-hidden hover:shadow-md hover:border-border transition-all duration-300 flex flex-col h-full cursor-pointer">
        {/* Image with bookmark overlay */}
        <div className="aspect-square w-full overflow-hidden bg-muted/30 relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/20" />
            </div>
          )}
          {/* Bookmark button top-right overlay */}
          {/* {onToggleSave && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <BookmarkButton
                productId={product.id}
                isSaved={isSaved}
                onToggle={onToggleSave}
                compact
              />
            </div>
          )} */}
          {/* Always show when saved */}
          {/* {isSaved && onToggleSave && (
            <div className="absolute top-2 right-2">
              <BookmarkButton
                productId={product.id}
                isSaved={isSaved}
                onToggle={onToggleSave}
                compact
              />
            </div>
          )} */}
        </div>

        <div className="p-3 flex flex-col gap-2 flex-1">
          <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
            {title}
          </p>
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            {product.description}
          </p>
          <div className="mt-auto flex items-center justify-between">
            {price && (
              <p className="text-sm font-bold text-foreground/80">
                ${Number(price).toFixed(2)}
              </p>
            )}
          </div>
          {/* {showAddToCart && (
            <button className="mt-2 w-full py-2.5 rounded-xl bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 transition-colors active:scale-95">
              Add to Bag
            </button>
          )} */}
        </div>
      </div>
    );
  }

  // ─── LIST card ────────────────────────────────────────────────────────────
  return (
    <div className="group flex gap-4 rounded-2xl border border-border/50 bg-card p-4 hover:shadow-md hover:border-border transition-all duration-300 items-center cursor-pointer">
      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted/30 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-muted-foreground/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-base font-semibold text-foreground leading-snug line-clamp-2">
          {title}
        </p>
        {price && (
          <p className="text-sm font-bold text-foreground/80">
            ${Number(price).toFixed(2)}
          </p>
        )}
        {showTags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.slice(0, 3).map((t: any) => (
              <span
                key={t.id ?? t}
                className="text-[10px] uppercase font-semibold tracking-wider px-2 py-1 rounded-md bg-muted text-muted-foreground"
              >
                {t.name ?? t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bookmark on right side of list card */}
      {/* {onToggleSave && (
        <BookmarkButton
          productId={product.id}
          isSaved={isSaved}
          onToggle={onToggleSave}
        />
      )} */}

      {/* {showAddToCart && (
        <button className="shrink-0 px-5 py-2.5 rounded-xl bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 transition-colors active:scale-95">
          Add
        </button>
      )} */}
    </div>
  );
}

// ── ProductsPlayer ────────────────────────────────────────────────────────────
interface ProductsPlayerProps {
  data: ProductsBlockData;
  accumulatedTags: string[];
  formId: string;
  // NEW
  savedProductIds?: Set<string>;
  onToggleSave?: (productId: string) => Promise<void>;
}
function ProductsPlayer({
  data,
  accumulatedTags,
  formId,
  savedProductIds, // NEW
  onToggleSave, // NEW
}: ProductsPlayerProps) {
  const limit = data.resultLimit ?? 12;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const tagKey = accumulatedTags.slice().sort().join(",");

  useEffect(() => {
    if (data.mode === "manual") {
      setProducts((data.pinnedProducts ?? []).slice(0, limit));
      setLoading(false);
      return;
    }

    if (accumulatedTags.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    fetch("/api/products/by-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formId,
        tagIds: accumulatedTags,
        strategy: data.matchStrategy === "all" ? "all" : "any",
        limit,
      }),
    })
      .then((res) => res.json())
      .then(({ products: fetched }) => setProducts(fetched ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [tagKey, formId, data.mode, data.matchStrategy, limit]);

  if (loading) {
    return (
      <div className="w-full space-y-5 animate-in fade-in">
        {data.heading && (
          <p className="text-xl font-bold text-foreground tracking-tight">
            {data.heading}
          </p>
        )}
        <div
          className={
            data.layout === "grid" ? "grid grid-cols-2 gap-4" : "space-y-4"
          }
        >
          {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-border/40 bg-card overflow-hidden animate-pulse
                ${data.layout === "grid" ? "flex flex-col h-[280px]" : "flex gap-4 p-4 h-28"}`}
            >
              <div
                className={`bg-muted/40 ${
                  data.layout === "grid"
                    ? "h-2/3 w-full"
                    : "w-20 h-20 rounded-xl shrink-0"
                }`}
              />
              <div
                className={`flex-1 space-y-2.5 ${data.layout === "grid" ? "p-4" : "py-2"}`}
              >
                <div className="h-3.5 bg-muted/60 rounded-full w-3/4" />
                <div className="h-3.5 bg-muted/60 rounded-full w-1/2" />
                <div className="h-3 bg-muted/40 rounded-full w-1/4 mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center gap-4 text-center bg-card rounded-3xl border border-border/40 border-dashed">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
          <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <p className="text-base font-medium text-muted-foreground/80 max-w-xs">
          {data.fallbackMessage ??
            "We couldn't find exact matches for your selections."}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      {data.heading && (
        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
          {data.heading}
        </p>
      )}
      {data.layout === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              product={p}
              compact
              showAddToCart={data.showAddToCart}
              showTags={data.showProductTags}
              isSaved={savedProductIds?.has(p.id) ?? false} // NEW
              onToggleSave={onToggleSave} // NEW
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              product={p}
              compact={false}
              showAddToCart={data.showAddToCart}
              showTags={data.showProductTags}
              isSaved={savedProductIds?.has(p.id) ?? false} // NEW
              onToggleSave={onToggleSave} // NEW
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── StepRenderer ─────────────────────────────────────────────────────────────

function StepRenderer({
  step,
  session,
  isPreview,
  formId,
  savedProductIds,
  onToggleSave,
  effectiveCustomerId, // ← ADD
}: {
  step: CanvasStep;
  session: Session;
  isPreview?: boolean;
  formId: string;
  savedProductIds?: Set<string>;
  onToggleSave?: (id: string) => Promise<void>;
  effectiveCustomerId?: string | null; // ← ADD
}) {
  const {
    selectOption,
    submitText,
    submitRating,
    advance,
    submitContact,
    accumulatedTags,
    isSubmitting,
  } = session;

  return (
    <div className="space-y-8 sm:space-y-10">
      {step.blocks?.map((block) => {
        const { data } = block;

        switch (data.type) {
          case "h1":
          case "h2":
          case "h3":
            return <HeadingPlayer key={block.id} data={data} />;

          case "paragraph":
            return <ParagraphPlayer key={block.id} data={data} />;

          case "image":
            return <ImagePlayer key={block.id} data={data} />;

          case "carousel":
            return <CarouselPlayer key={block.id} data={data} />;

          case "divider":
            return <DividerPlayer key={block.id} data={data} />;

          case "spacer":
            return <SpacerPlayer key={block.id} data={data} />;

          case "select":
            return (
              <SelectPlayer
                key={block.id}
                data={data}
                blockId={block.id}
                onSingleSelect={(opt) =>
                  selectOption(block.id, opt.id, {
                    tags: opt.tags,
                    nextStepId: opt.nextStepId ?? step.nextStepId,
                    autoAdvance: true,
                  })
                }
                onMultiSubmit={(ids, tags) => {
                  selectOption(block.id, ids, { tags });
                  advance(step.nextStepId);
                }}
              />
            );

          case "text-input":
            return (
              <TextInputPlayer
                key={block.id}
                data={data}
                onSubmit={(value) => {
                  submitText(block.id, value);
                  advance(step.nextStepId);
                }}
                onChange={(value) => {
                  submitText(block.id, value); // This saves it to session state in real-time
                }}
              />
            );

          case "rating":
            return (
              <RatingPlayer
                key={block.id}
                data={data}
                onSubmit={(value) => {
                  submitRating(block.id, value);
                  advance(step.nextStepId);
                }}
              />
            );

          case "button":
            return (
              <ButtonPlayer
                key={block.id}
                data={data}
                onAdvance={(nextStepId) => advance(nextStepId)}
              />
            );

          case "contact":
            return (
              <ContactBlockPlayer
                key={block.id}
                data={data}
                isPreview={isPreview}
                customerId={effectiveCustomerId ?? null}
                onSubmit={async (contactData) => {
                  // ✅ ONLY commits data — never advances
                  const result = await submitContact(contactData);
                  return result;
                }}
                onAdvance={() => advance(data.nextStepId ?? step.nextStepId)} // ← user triggers this
                onSkip={
                  data.showSkip
                    ? () => advance(data.skipNextStepId ?? step.nextStepId)
                    : undefined
                }
                isSubmitting={isSubmitting}
              />
            );

          case "products":
            return (
              <ProductsPlayer
                key={block.id}
                data={data}
                accumulatedTags={accumulatedTags}
                formId={formId}
                savedProductIds={savedProductIds} // NEW
                onToggleSave={onToggleSave} // NEW
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-10 h-10 text-muted-foreground/30 animate-spin" />
      <p className="text-sm font-medium text-muted-foreground/60 tracking-wide">
        Preparing your experience...
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FlowPlayer
// ─────────────────────────────────────────────────────────────────────────────

// ── Main Component ─────────────────────────────────────────────────────────────

export function FlowPlayer({
  flow,
  formId,
  storeId,
  allProducts = [],
  redemptionCode,
  onComplete,
  showBanner = false,
  allowReset = true,
  isPreview = false,
}: FlowPlayerProps) {
  // ── Session ────────────────────────────────────────────────────────────────

  const session = useFlowSession({
    flow,
    formId,
    storeId,
    allProducts,
    redemptionCode,
    onComplete,
    isPreview,
  });

  const {
    phase,
    currentStep,
    stepIndex,
    totalSteps,
    canGoBack,
    init,
    goBack,
    reset,
  } = session;

  // ── State ─────────────────────────────────────────────────────────────────

  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [loginCustomerId, setLoginCustomerId] = useState<string | null>(null);

  // Hydrate local customer from localStorage on mount
  const [localCustomer, setLocalCustomer] =
    useState<LocalCustomerProfile | null>(null);

  // Sync customer from localStorage on mount (SSR safe)
  useEffect(() => {
    const saved = getLocalCustomer();
    if (saved) setLocalCustomer(saved);
  }, []);

  // ── Stable customerId across phase changes ────────────────────────────────
  // useFlowSession may clear session.customerId on "done" phase,
  // but we want to keep showing the customer's saved items after submit.
  const lastKnownCustomerIdRef = useRef<string | null>(null);
  const rawCustomerId = session.customerId ?? loginCustomerId;
  if (rawCustomerId) lastKnownCustomerIdRef.current = rawCustomerId;
  const effectiveCustomerId = rawCustomerId ?? lastKnownCustomerIdRef.current;

  // ── Saved Items ────────────────────────────────────────────────────────────

  const savedItemsHook = useSavedItems(
    session.sessionId,
    storeId ?? null,
    effectiveCustomerId,
  );

  // ── Sync localCustomer when contact form creates a customer ───────────────
  // e.g. user filled the form without using the login drawer —
  // session.customerId is now set but localCustomer is still null.
  useEffect(() => {
    if (!session.customerId) return;
    const existing = getLocalCustomer();
    if (existing?.id === session.customerId) {
      setLocalCustomer(existing);
    }
  }, [session.customerId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = useCallback((customer: LocalCustomerProfile) => {
    saveCustomerLocally(customer);
    setLocalCustomer(customer);
    setLoginCustomerId(customer.id);
    // Drawer stays open — CustomerProfileDrawer switches to profile phase internally
  }, []);

  const handleReset = useCallback(async () => {
    reset();
    await init();
  }, [reset, init]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    init();
    flowLog("FLOW_PLAYER_MOUNT", {
      formId,
      isPreview,
      totalSteps: flow.steps.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = useCallback(() => {
    setLocalCustomer(null);
    setLoginCustomerId(null);
    // Don't call session.reset() — flow progress stays intact
    // Just the identity is cleared, next contact step will show the form again
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-h-[100dvh] bg-muted/10 sm:bg-muted/20 flex flex-col items-center justify-start sm:py-12 py-0">
      {/* Container */}
      <div className="w-full max-w-xl flex flex-col sm:px-4 px-0 flex-1 sm:flex-initial">
        {/* Preview banner */}

        {/* Flow name banner */}
        {showBanner && (
          <div className="w-full mb-6">
            <h1 className="text-sm font-bold text-muted-foreground/50 uppercase tracking-[0.2em] text-center">
              {flow.name}
            </h1>
          </div>
        )}

        {/* ── Main Card ─────────────────────────────────────────────────── */}
        <div className="w-full bg-card sm:rounded-[2rem] sm:shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:border border-border/40 overflow-hidden flex-1 flex flex-col">
          {/* Progress & Back header */}
          {phase === "quiz" && totalSteps > 1 && (
            <div className="px-6 sm:px-10 my-4 sticky top-0 bg-card/80 backdrop-blur-xl z-20 border-b border-border/10 sm:border-none">
              <div className="flex items-center gap-4">
                {canGoBack ? (
                  <button
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex items-center gap-2 pr-3 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all active:scale-90"
                  >
                    <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                    <p className="text-sm font-bold text-muted-foreground/60 tracking-wide">
                      Back
                    </p>
                  </button>
                ) : (
                  <div className="w-10 h-10 -ml-2 shrink-0" />
                )}
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="px-6 sm:px-10 pb-24 sm:pb-16 flex-1 flex flex-col">
            {phase === "loading" && <LoadingState />}

            {phase === "quiz" && currentStep && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
                <StepRenderer
                  step={currentStep}
                  session={session}
                  isPreview={isPreview}
                  formId={formId}
                  savedProductIds={savedItemsHook.savedProductIds}
                  onToggleSave={savedItemsHook.toggleSave}
                  effectiveCustomerId={effectiveCustomerId} // ← ADD
                />
              </div>
            )}

            {phase === "quiz" && !currentStep && (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-base font-medium text-muted-foreground/60">
                  This flow is currently empty.
                </p>
              </div>
            )}
          </div>
        </div>
        {/* ── End Main Card ─────────────────────────────────────────────── */}

        {/* Powered by footer */}
        <div className="py-6 sm:py-8 flex justify-center w-full">
          <p className="text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest flex items-center gap-2">
            Powered by <span className="text-foreground/40">Mirour</span>
          </p>
        </div>
      </div>
      {/* ── End container ─────────────────────────────────────────────────── */}

      {/* ── Floating bar + drawer — outside card, outside container ────────── */}
      {/* {!isPreview && phase !== "done" && (
        <>
          <FloatingProfileBar
            onClick={() => setProfileDrawerOpen(true)}
            savedCount={savedItemsHook.savedItems.length}
            customer={localCustomer}
          />

          <CustomerProfileDrawer
            open={profileDrawerOpen}
            onClose={() => setProfileDrawerOpen(false)}
            savedItems={savedItemsHook.savedItems}
            onRemoveSavedItem={savedItemsHook.toggleSave}
            onLogin={handleLogin}
            onLogout={handleLogout}
            customerId={effectiveCustomerId}
            allProducts={allProducts}
          />
        </>
      )} */}
    </div>
  );
}
