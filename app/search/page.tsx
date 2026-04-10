// app/(store)/search/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ProductResult {
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

const SUGGESTIONS = [
  "something relaxing to drink",
  "low sugar energy drink",
  "drink for sleep",
  "refreshing summer drink",
];

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── DIALOG ──────────────────────────────────────────────────────────────────
function ProductDialog({
  product,
  onClose,
}: {
  product: ProductResult;
  onClose: () => void;
}) {
  const pct = Math.round(product.similarity * 100);

  // Close on backdrop click or Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">
        {/* Image */}
        <div className="relative w-full aspect-video bg-gray-100 flex-shrink-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                className="w-16 h-16 text-gray-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  strokeWidth="1.5"
                />
                <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
                <path
                  d="m21 15-5-5L5 21"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}

          {/* Match badge over image */}
          {/* <div className="absolute top-3 left-3">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
                pct >= 75
                  ? "bg-teal-600 text-white"
                  : pct >= 55
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-white"
              }`}
            >
              {pct}% match
            </span>
          </div> */}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M18 6 6 18M6 6l12 12"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {product.name}
            </h2>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {product.price != null && (
                <span className="text-xl font-bold text-gray-900">
                  ${product.price.toFixed(2)}
                </span>
              )}
              <span
                className={`text-xs font-medium ${
                  product.in_stock ? "text-green-600" : "text-gray-400"
                }`}
              >
                {product.in_stock ? "In stock" : "Out of stock"}
              </span>
            </div>
          </div>

          {product.sku && (
            <p className="text-xs text-gray-400 mb-3 font-mono">
              SKU: {product.sku}
            </p>
          )}

          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {product.description}
            </p>
          )}

          {product.tags?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {/* <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <button
            disabled={!product.in_stock}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white"
          >
            {product.in_stock ? "Add to cart" : "Out of stock"}
          </button>
        </div> */}
      </div>
    </div>
  );
}

// ─── PRODUCT CARD (grid) ──────────────────────────────────────────────────────
function ProductCard({
  product,
  onClick,
}: {
  product: ProductResult;
  onClick: () => void;
}) {
  const pct = Math.round(product.similarity * 100);
  const matchColor =
    pct >= 75
      ? "text-teal-700 bg-teal-50"
      : pct >= 55
        ? "text-green-700 bg-green-50"
        : "text-gray-500 bg-gray-100";


        console.log(product);

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-teal-200 hover:shadow-md transition-all text-left flex flex-col focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
      aria-label={`View ${product.name}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-gray-50 overflow-hidden flex-shrink-0">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-gray-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                strokeWidth="1.5"
              />
              <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
              <path
                d="m21 15-5-5L5 21"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* Match badge */}
        {/* <span
          className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${matchColor}`}
        >
          {pct}%
        </span> */}

        {/* Out of stock overlay */}
        {!product.in_stock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
          {product.name}
        </h3>

        {product.description && (
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Tags */}
        {/* {product.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {product.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full"
              >
                {tag}
              </span>
            ))}
            {product.tags.length > 3 && (
              <span className="text-xs text-gray-300">
                +{product.tags.length - 3}
              </span>
            )}
          </div>
        )} */}

        {/* Price row */}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-50">
          {product.price != null ? (
            <span className="text-sm font-bold text-gray-900">
              ${product.price.toFixed(2)}
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs text-teal-600 font-medium group-hover:underline">
            View details →
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── SKELETON CARD ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="w-full aspect-square bg-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="flex gap-1 pt-1">
          <div className="h-4 w-12 bg-gray-100 rounded-full" />
          <div className="h-4 w-14 bg-gray-100 rounded-full" />
        </div>
        <div className="h-4 bg-gray-100 rounded w-1/3 pt-1" />
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function SemanticSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<ProductResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 400);

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
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Search failed");
      }

      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err: any) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  function handleSuggestion(s: string) {
    setQuery(s);
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Search bar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-600 transition-all">
            <svg
              className="w-5 h-5 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path
                d="m21 21-4.35-4.35"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: something relaxing to drink…"
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setHasSearched(false);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
                aria-label="Clear search"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {!query && (
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-500 hover:border-teal-600 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Results meta */}
        {!loading && !error && hasSearched && results.length > 0 && (
          <p className="text-xs text-gray-400 mb-4">
            {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-teal-700 italic">"{query}"</span>
          </p>
        )}

        {/* Loading skeletons — grid */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16 text-red-500 text-sm">{error}</div>
        )}

        {/* Results grid */}
        {!loading && !error && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => setSelected(product)}
              />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm mb-1">
              No matches for "{query}"
            </p>
            <p className="text-gray-400 text-xs">Try rephrasing your search</p>
          </div>
        )}

        {/* Idle */}
        {!loading && !hasSearched && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">
              Start typing to search products
            </p>
          </div>
        )}
      </div>

      {/* ── Detail dialog ── */}
      {selected && (
        <ProductDialog product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
