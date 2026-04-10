// components/canvas/AiSearchPlayer.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, ShoppingBag, Sparkles, Bookmark, Heart } from "lucide-react";
import type { AiSearchBlockData } from "@/types/canvas";

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

// ── Debounce hook ─────────────────────────────────────────────────────────────

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
      <div className="aspect-square bg-muted/40" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted/60 rounded-full w-3/4" />
        <div className="h-3 bg-muted/40 rounded-full w-1/2" />
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AiSearchPlayerProps {
  data: AiSearchBlockData;
  savedProductIds?: Set<string>;
  onToggleSave?: (productId: string) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiSearchPlayer({
  data,
  savedProductIds,
  onToggleSave,
}: AiSearchPlayerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 400);
  const limit = data.resultLimit ?? 6;

  const search = useCallback(
    async (q: string) => {
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
          body: JSON.stringify({ query: trimmed, limit }),
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
    },
    [limit],
  );

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      {data.heading && (
        <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-snug">
          {data.heading}
        </p>
      )}
      {data.description && (
        <p className="text-sm text-muted-foreground/70 leading-relaxed -mt-2">
          {data.description}
        </p>
      )}

      {/* Search bar */}
      <div className="relative flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-5 py-4 shadow-sm focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary transition-all">
        {loading ? (
          <Loader2 className="w-5 h-5 text-muted-foreground/40 shrink-0 animate-spin" />
        ) : (
          <Search className="w-5 h-5 text-muted-foreground/40 shrink-0" />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={data.placeholder ?? "Search products…"}
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30 text-base"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setHasSearched(false);
              inputRef.current?.focus();
            }}
            className="text-muted-foreground/40 hover:text-foreground p-1 rounded-full transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results */}
      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Result grid — uses same ProductCard as ProductsBlock */}
      {!loading && !error && results.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground/50">
            {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="font-semibold text-foreground/70">"{query}"</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {results.map((product) => {
              const isSaved = savedProductIds?.has(product.id) ?? false;
              const imageUrl = product.image_url ?? null;
              const title = product.name ?? "Product";
              return (
                <div
                  key={product.id}
                  className="group rounded-2xl border border-border/50 bg-card overflow-hidden hover:shadow-md hover:border-border transition-all duration-300 flex flex-col h-full cursor-pointer"
                >
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
                    {onToggleSave && (
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          onClick={() => onToggleSave(product.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border transition-all active:scale-90 ${
                            isSaved
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background/90 text-muted-foreground border-border/60 hover:border-primary/40"
                          }`}
                          aria-label={isSaved ? "Unsave" : "Save"}
                        >
                          <Heart className={`w-3.5 h-3.5 ${ isSaved ? "fill-current" : ""}`} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{title}</p>
                    {product.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{product.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* No results */}
      {!loading && !error && hasSearched && results.length === 0 && (
        <div className="text-center py-12 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-muted-foreground/30" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground/70">
              No matches for "{query}"
            </p>
            <p className="text-xs text-muted-foreground/40 mt-0.5">
              Try rephrasing your search
            </p>
          </div>
        </div>
      )}

      {/* Idle state */}
      {!loading && !hasSearched && (
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground/40">
            Start typing to search products
          </p>
        </div>
      )}

   
    </div>
  );
}
