// components/canvas/BlockRenderer.tsx
"use client";

import {
  Star,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ShoppingBag,
} from "lucide-react";
import type { CanvasBlock, AspectRatio, SelectOption } from "@/types/canvas";

// ── Helpers ───────────────────────────────────────────────────────────────────

const RATIO_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "4:3": "aspect-[4/3]",
  "3:2": "aspect-[3/2]",
  auto: "aspect-auto",
};

function aspectRatioPadding(ratio?: AspectRatio): string {
  switch (ratio) {
    case "1:1":
      return "100%";
    case "16:9":
      return "56.25%";
    case "4:3":
      return "75%";
    case "3:2":
      return "66.66%";
    default:
      return "0";
  }
}

function ImagePlaceholder({
  borderRadius,
  aspectRatio,
}: {
  borderRadius?: number;
  aspectRatio?: AspectRatio;
}) {
  const useAspect = aspectRatio && aspectRatio !== "auto";

  return (
    <div
      style={{
        borderRadius: borderRadius ?? 16,
        ...(useAspect
          ? {
              position: "relative",
              paddingBottom: aspectRatioPadding(aspectRatio),
            }
          : { minHeight: 160 }),
      }}
      className="w-full bg-muted/60 border-2 border-dashed border-border
        flex items-center justify-center overflow-hidden"
    >
      <div
        style={useAspect ? { position: "absolute", inset: 0 } : {}}
        className="flex flex-col items-center justify-center gap-1
          text-muted-foreground/50 w-full h-full"
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
          <path d="M21 15l-5-5L5 21" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-xs">No image set</span>
      </div>
    </div>
  );
}

// ── Carousel block ────────────────────────────────────────────────────────────

function CarouselBlock({
  data,
}: {
  data: Extract<CanvasBlock["data"], { type: "carousel" }>;
}) {
  const items = data.items ?? [];
  const alignJustify =
    data.align === "left"
      ? "flex-start"
      : data.align === "right"
        ? "flex-end"
        : "center";

  if (items.length === 0) {
    return (
      <div
        className="w-full flex pointer-events-none"
        style={{ justifyContent: alignJustify }}
      >
        <div style={{ width: `${data.width ?? 100}%` }}>
          <ImagePlaceholder
            borderRadius={data.borderRadius}
            aspectRatio={data.aspectRatio}
          />
        </div>
      </div>
    );
  }

  const isAuto = data.aspectRatio === "auto";
  const aspectClass = isAuto
    ? ""
    : RATIO_CLASS[data.aspectRatio ?? "16:9"] ?? "aspect-video";

  return (
    <div
      className="w-full flex pointer-events-none"
      style={{ justifyContent: alignJustify }}
    >
      <div
        className="relative group"
        style={{ width: `${data.width ?? 100}%` }}
      >
        <div
          className={`w-full overflow-hidden shadow-sm border border-border/20 relative bg-muted/20 ${aspectClass}`}
          style={{ borderRadius: data.borderRadius ?? 16 }}
        >
          <img
            src={items[0].src}
            alt={items[0].alt || ""}
            className={`transition-opacity duration-500 ease-in-out ${
              isAuto
                ? "w-full h-auto block"
                : `w-full h-full object-${data.items?.[0] ? "cover" : "cover"}`
            }`}
            style={{ objectPosition: data.objectPosition ?? "50% 50%" }}
          />

          {data.showArrows && items.length > 1 && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5" />
          )}
        </div>

        {data.showArrows && items.length > 1 && (
          <>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-md text-foreground shadow-sm flex items-center justify-center sm:flex hidden">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-md text-foreground shadow-sm flex items-center justify-center sm:flex hidden">
              <ChevronRight className="w-5 h-5" />
            </div>
          </>
        )}

        {data.showDots && items.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {items.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === 0 ? "w-6 bg-foreground/80" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        )}

        {items[0].caption && (
          <p className="text-sm text-center font-medium text-muted-foreground/70 mt-3">
            {items[0].caption}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Select block ──────────────────────────────────────────────────────────────

function SelectBlock({
  data,
}: {
  data: Extract<CanvasBlock["data"], { type: "select" }>;
}) {
  const isGrid = data.layout === "grid";
  const isMulti = data.selectionMode === "multi";

  return (
    <div className="w-full space-y-5 pointer-events-none">
      {data.question && (
        <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
          {data.question}
        </p>
      )}

      {data.options.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-8 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/40">
            No options added yet
          </p>
        </div>
      ) : (
        <div className={isGrid ? "grid grid-cols-2 gap-3" : "space-y-3"}>
          {data.options.map((opt: SelectOption, idx: number) => {
            const isSel = idx === 0; // Simulate first item as selected for preview

            return (
              <div
                key={opt.id}
                className={`w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border transition-all duration-200 group
                  ${isGrid ? "flex-col text-center justify-center min-h-[120px]" : "justify-between"}
                  ${
                    isSel
                      ? "border-primary bg-primary/5 shadow-[0_4px_14px_rgba(0,0,0,0.03)]"
                      : "border-border/60 bg-card"
                  }`}
              >
                <div
                  className={`flex items-center gap-4 ${isGrid ? "flex-col" : "w-full"}`}
                >
                  {!isGrid && (
                    <div className="shrink-0">
                      {isMulti ? (
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSel
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30 bg-background"
                          }`}
                        >
                          {isSel && (
                            <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                          )}
                        </div>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSel
                              ? "border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSel && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {opt.imageUrl && opt.imageUrl.trim() !== "" && (
                    <img
                      src={opt.imageUrl}
                      alt=""
                      className={`object-cover rounded-xl shrink-0 shadow-sm border border-border/20 ${
                        isGrid ? "w-14 h-14" : "w-10 h-10"
                      }`}
                    />
                  )}

                  <span
                    className={`font-semibold text-foreground/90 ${
                      isGrid
                        ? "text-sm leading-tight"
                        : "flex-1 text-left text-sm"
                    }`}
                  >
                    {opt.label || `Option ${idx + 1}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isMulti && (
        <div className="w-full mt-4 py-4 rounded-2xl bg-foreground text-background font-bold text-base flex items-center justify-center opacity-40">
          Continue
        </div>
      )}
    </div>
  );
}

// ── Contact block ─────────────────────────────────────────────────────────────

function ContactBlock({
  data,
}: {
  data: Extract<CanvasBlock["data"], { type: "contact" }>;
}) {
  const f = data.fields;
  const enabledFields = Object.entries(f).filter(([, cfg]) => cfg.enabled);

  return (
    <div className="w-full space-y-6 pointer-events-none">
      {data.heading && (
        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
          {data.heading}
        </p>
      )}

      <div className="space-y-4">
        {f.firstName.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              First Name {f.firstName.required && "*"}
            </label>
            <div className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-muted-foreground/30 shadow-sm flex items-center">
              Jane
            </div>
          </div>
        )}
        {f.lastName.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Last Name {f.lastName.required && "*"}
            </label>
            <div className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-muted-foreground/30 shadow-sm flex items-center">
              Doe
            </div>
          </div>
        )}
        {f.email.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Email Address {f.email.required && "*"}
            </label>
            <div className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-muted-foreground/30 shadow-sm flex items-center">
              jane@example.com
            </div>
          </div>
        )}
        {f.phone.enabled && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
              Phone Number {f.phone.required && "*"}
            </label>
            <div className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-muted-foreground/30 shadow-sm flex items-center">
              (555) 000-0000
            </div>
          </div>
        )}

        {enabledFields.length === 0 && (
          <div className="border border-dashed border-border rounded-xl py-6 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/40">
              No fields enabled
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 space-y-3">
        <div className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base flex items-center justify-center gap-2 opacity-60">
          {data.submitLabel || "Continue"}
        </div>
        {data.showSkip && (
          <div className="w-full py-3 text-center text-sm font-medium text-muted-foreground">
            {data.skipLabel ?? "Skip this step"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Text input block ──────────────────────────────────────────────────────────

function TextInputBlock({
  data,
}: {
  data: Extract<CanvasBlock["data"], { type: "text-input" }>;
}) {
  return (
    <div className="w-full space-y-5 pointer-events-none">
      {data.question && (
        <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
          {data.question}
        </p>
      )}

      {data.multiline ? (
        <div className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-muted-foreground/40 min-h-[140px] shadow-sm">
          {data.placeholder || "Type your answer here..."}
        </div>
      ) : (
        <div className="w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-base text-muted-foreground/40 shadow-sm">
          {data.placeholder || "Type your answer here..."}
        </div>
      )}
    </div>
  );
}

// ── Rating block ──────────────────────────────────────────────────────────────

function RatingBlock({
  data,
}: {
  data: Extract<CanvasBlock["data"], { type: "rating" }>;
}) {
  const max = data.maxStars ?? 5;
  const previewFilled = 3;

  if (data.ratingType === "thumbs") {
    return (
      <div className="w-full space-y-5 pointer-events-none">
        {data.question && (
          <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug text-center">
            {data.question}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          <div className="flex flex-col items-center justify-center gap-3 w-32 h-32 rounded-3xl border-2 font-semibold text-base transition-all duration-200 border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm scale-110">
            <ThumbsUp className="w-8 h-8 scale-110" />
            Yes
          </div>
          <div className="flex flex-col items-center justify-center gap-3 w-32 h-32 rounded-3xl border-2 font-semibold text-base transition-all duration-200 border-border/60 bg-card text-foreground/70">
            <ThumbsDown className="w-8 h-8" />
            No
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pointer-events-none">
      {data.question && (
        <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug text-center">
          {data.question}
        </p>
      )}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className="p-1">
            <Star
              className={`w-10 h-10 sm:w-12 sm:h-12 transition-all duration-200 ${
                i < previewFilled
                  ? "fill-amber-400 text-amber-400 drop-shadow-sm scale-110"
                  : "fill-none text-muted-foreground/30"
              }`}
            />
          </div>
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

// ── Products block ────────────────────────────────────────────────────────────

function ProductCardStatic({
  product,
  compact,
  showTags,
}: {
  product: any;
  compact: boolean;
  showTags?: boolean;
}) {
  const title = product.name ?? product.title ?? "Product";
  const imageUrl = product.imageurl ?? product.imageUrl ?? null;
  const price = product.price ?? null;
  const tags = product.tags ?? [];

  if (compact) {
    return (
      <div className="group rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col h-full">
        <div className="aspect-square w-full overflow-hidden bg-muted/30 relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover mix-blend-multiply"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/20" />
            </div>
          )}
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
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-4 rounded-2xl border border-border/50 bg-card p-4 items-center">
      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted/30 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover mix-blend-multiply"
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
    </div>
  );
}

function ProductsBlock({
  data,
}: {
  data: Extract<CanvasBlock["data"], { type: "products" }>;
}) {
  const isGrid = data.layout === "grid";
  const isTagged = data.mode === "tagged";
  const pins = data.pinnedProducts ?? [];
  const limit = data.resultLimit ?? 12;
  const skeletonCount = isTagged ? Math.min(limit, 4) : 0;

  return (
    <div className="w-full space-y-5 pointer-events-none">
      {data.heading && (
        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
          {data.heading}
        </p>
      )}

      {isTagged || pins.length === 0 ? (
        <div
          className={
            isGrid
              ? "grid grid-cols-2 gap-3 sm:gap-5"
              : "space-y-3 sm:space-y-4"
          }
        >
          {Array.from({ length: skeletonCount > 0 ? skeletonCount : 2 }).map(
            (_, i) => (
              <div
                key={i}
                className={`rounded-2xl border border-border/40 bg-card overflow-hidden
                ${isGrid ? "flex flex-col h-[280px]" : "flex gap-4 p-4 h-28"}`}
              >
                <div
                  className={`bg-muted/40 ${
                    isGrid ? "h-2/3 w-full" : "w-20 h-20 rounded-xl shrink-0"
                  }`}
                />
                <div
                  className={`flex-1 space-y-2.5 ${isGrid ? "p-4" : "py-2"}`}
                >
                  <div className="h-3.5 bg-muted/60 rounded-full w-3/4" />
                  <div className="h-3.5 bg-muted/60 rounded-full w-1/2" />
                  <div className="h-3 bg-muted/40 rounded-full w-1/4 mt-4" />
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div
          className={
            isGrid
              ? "grid grid-cols-2 gap-3 sm:gap-5"
              : "space-y-3 sm:space-y-4"
          }
        >
          {pins.slice(0, 4).map((p) => (
            <ProductCardStatic
              key={p.id}
              product={p}
              compact={isGrid}
              showTags={data.showProductTags}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main BlockRenderer ────────────────────────────────────────────────────────

export function BlockRenderer({ block }: { block: CanvasBlock }) {
  const { data } = block;

  switch (data.type) {
    // ── Headings ─────────────────────────────────────────────────────────────
    case "h1":
      return (
        <h1
          style={{ textAlign: data.align, color: data.color ?? undefined }}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight w-full text-foreground/90 pointer-events-none"
        >
          {data.text || (
            <span className="text-muted-foreground/40 italic">
              Empty heading
            </span>
          )}
        </h1>
      );

    case "h2":
      return (
        <h2
          style={{ textAlign: data.align, color: data.color ?? undefined }}
          className="text-xl sm:text-2xl font-bold tracking-tight leading-snug w-full text-foreground/90 pointer-events-none"
        >
          {data.text || (
            <span className="text-muted-foreground/40 italic">
              Empty subheading
            </span>
          )}
        </h2>
      );

    case "h3":
      return (
        <h3
          style={{ textAlign: data.align, color: data.color ?? undefined }}
          className="text-lg sm:text-xl font-semibold tracking-tight leading-snug w-full text-foreground/90 pointer-events-none"
        >
          {data.text || (
            <span className="text-muted-foreground/40 italic">Empty title</span>
          )}
        </h3>
      );

    // ── Paragraph ─────────────────────────────────────────────────────────────
    case "paragraph":
      return (
        <p
          style={{
            textAlign: data.align,
            color: data.color ?? undefined,
            fontSize: data.fontSize ? `${data.fontSize}px` : undefined,
          }}
          className="w-full leading-relaxed text-foreground/70 sm:text-base text-sm font-medium pointer-events-none"
        >
          {data.text || (
            <span className="text-muted-foreground/40 italic">
              Empty paragraph
            </span>
          )}
        </p>
      );

    // ── Image ──────────────────────────────────────────────────────────────────
    case "image": {
      const imgAlign = data.align ?? "center";
      const alignJustify =
        imgAlign === "left"
          ? "flex-start"
          : imgAlign === "right"
            ? "flex-end"
            : "center";
      const isAuto = data.aspectRatio === "auto";
      const aspectClass = isAuto
        ? ""
        : RATIO_CLASS[data.aspectRatio ?? "16:9"] ?? "aspect-video";

      if (!data.src) {
        return (
          <div
            className="w-full flex pointer-events-none"
            style={{ justifyContent: alignJustify }}
          >
            <div style={{ width: `${data.width ?? 100}%` }}>
              <ImagePlaceholder
                borderRadius={data.borderRadius ?? 16}
                aspectRatio={data.aspectRatio}
              />
            </div>
          </div>
        );
      }

      return (
        <div
          className="w-full flex pointer-events-none"
          style={{ justifyContent: alignJustify }}
        >
          <div
            style={{
              width: `${data.width ?? 100}%`,
              borderRadius: `${data.borderRadius ?? 16}px`,
              overflow: "hidden",
            }}
            className={isAuto ? "" : aspectClass}
          >
            <img
              src={data.src}
              alt={data.alt || ""}
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

    // ── Carousel ───────────────────────────────────────────────────────────────
    case "carousel":
      return <CarouselBlock data={data} />;

    // ── Select ─────────────────────────────────────────────────────────────────
    case "select":
      return <SelectBlock data={data} />;

    // ── Contact ────────────────────────────────────────────────────────────────
    case "contact":
      return <ContactBlock data={data} />;

    // ── Text Input ─────────────────────────────────────────────────────────────
    case "text-input":
      return <TextInputBlock data={data} />;

    // ── Rating ─────────────────────────────────────────────────────────────────
    case "rating":
      return <RatingBlock data={data} />;

    // ── Button ─────────────────────────────────────────────────────────────────
    case "button": {
      const variantCls = {
        filled: "bg-foreground text-background",
        outline: "border-2 border-border text-foreground",
        ghost: "text-foreground",
      }[data.variant ?? "filled"];

      const alignCls = {
        left: "justify-start",
        center: "justify-center",
        right: "justify-end",
      }[data.align ?? "center"];

      return (
        <div className={`w-full flex ${alignCls} pointer-events-none`}>
          <div
            style={{
              backgroundColor:
                data.variant === "filled" && data.bgColor
                  ? data.bgColor
                  : undefined,
              color: data.textColor ?? undefined,
              borderRadius: `${data.borderRadius ?? 16}px`,
            }}
            className={`flex items-center gap-2.5 px-8 py-4 font-bold text-base transition-all duration-200
              ${variantCls} ${data.fullWidth ? "w-full justify-center" : ""}`}
          >
            {data.label || "Button"}
          </div>
        </div>
      );
    }

    // ── Products ────────────────────────────────────────────────────────────────
    case "products":
      return <ProductsBlock data={data} />;

    // ── Divider ────────────────────────────────────────────────────────────────
    case "divider":
      return (
        <div className="w-full flex items-center justify-center py-4 pointer-events-none">
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

    // ── Spacer ─────────────────────────────────────────────────────────────────
    case "spacer":
      return (
        <div
          style={{ height: data.height }}
          className="w-full flex items-center justify-center pointer-events-none select-none"
        >
          <div className="border border-dashed border-border/20 w-full h-full flex items-center justify-center bg-muted/10 rounded">
            <span className="text-[10px] text-muted-foreground/30">
              {data.height}px spacer
            </span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
