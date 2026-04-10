// components/flow/AiSearchOverlay.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Loader2,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import { BookmarkButton } from "./BookmarkButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiSearchResult {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  in_stock: boolean;
  similarity: number;
  tags: string[];
  image_url?: string | null;
  sku?: string | null;
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden animate-pulse flex flex-col">
      <div className="aspect-square bg-muted/50" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted/60 rounded-full w-3/4" />
        <div className="h-3 bg-muted/40 rounded-full w-1/2" />
      </div>
    </div>
  );
}

// ── Product card — exact same markup as FlowPlayer compact ProductCard ─────────

function ResultCard({
  product,
  isSaved,
  onToggleSave,
}: {
  product: AiSearchResult;
  isSaved: boolean;
  onToggleSave?: (id: string) => Promise<void>;
}) {
  const title = product.name ?? "Product";
  const imageUrl = product.image_url ?? null;

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

        {/* Bookmark button — top-right, same as ProductCard */}
        {onToggleSave && (
          <div className="absolute top-2 right-2 z-10">
            <BookmarkButton
              productId={product.id}
              isSaved={isSaved}
              onToggle={onToggleSave}
              compact
            />
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
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AiSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  formId?: string;
  savedProductIds?: Set<string>;
  onToggleSave?: (productId: string) => Promise<void>;
}

// ── Overlay content ───────────────────────────────────────────────────────────

function OverlayContent({
  onClose,
  savedProductIds,
  onToggleSave,
}: Omit<AiSearchOverlayProps, "open" | "formId">) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 420);

  // Auto-focus
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await fetch("/api/inventory/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, limit: 12 }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Search failed");
      }
      const d = await res.json();
      setResults(d.results ?? []);
    } catch (err: any) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-background animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="AI Product Search"
    >
      {/* ── Header bar ── */}
      <div className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-border/50 shrink-0 bg-background/80 backdrop-blur-sm">
        {/* Back / Close button — clearly labelled, left side */}
        <button
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all shrink-0"
          aria-label="Close search"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Search input — single clear X only when text present */}
        <div className="flex-1 flex items-center gap-2.5 bg-muted/40 border border-border/50 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/60 focus-within:bg-card transition-all">
          {loading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground/50 shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you're looking for…"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30 text-sm"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 text-muted-foreground transition-colors shrink-0"
              aria-label="Clear"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable results area ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">

        {/* Result count */}
        {!loading && !error && hasSearched && results.length > 0 && (
          <p className="text-[11px] text-muted-foreground/50 mb-4">
            {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="font-semibold text-foreground/60">"{query}"</span>
          </p>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => search(query)}
              className="text-xs text-muted-foreground underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results grid */}
        {!loading && !error && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((product) => (
              <ResultCard
                key={product.id}
                product={product}
                isSaved={savedProductIds?.has(product.id) ?? false}
                onToggleSave={onToggleSave}
              />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground/60">
                No matches found
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                Try different words or describe the style you want
              </p>
            </div>
            <button
              onClick={clearQuery}
              className="text-xs font-medium text-primary/70 hover:text-primary transition-colors"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Idle state */}
        {!loading && !hasSearched && (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
              <Search className="w-7 h-7 text-primary/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground/60">
                Search anything
              </p>
              <p className="text-sm text-muted-foreground/40 mt-1 max-w-xs">
                Describe what you're looking for in your own words
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portal wrapper ────────────────────────────────────────────────────────────

export function AiSearchOverlay({
  open,
  onClose,
  formId,
  savedProductIds,
  onToggleSave,
}: AiSearchOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <OverlayContent
      onClose={onClose}
      savedProductIds={savedProductIds}
      onToggleSave={onToggleSave}
    />,
    document.body,
  );
}
