// components/SemanticSearchBar.tsx
"use client";

import { useSemanticSearch } from "@/hooks/useSemanticSearch";

interface Props {
  storeId: string;
  onResultClick?: (productId: string) => void;
}

export function SemanticSearchBar({ storeId, onResultClick }: Props) {
  const { results, loading, error, query, hasSearched, search, clear } =
    useSemanticSearch();

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => search(e.target.value, storeId)}
          placeholder='Try "relaxing drink" or "low sugar energy"...'
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {/* Spinner / Clear */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <svg
              className="h-4 w-4 animate-spin text-text-muted"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : query ? (
            <button onClick={clear} className="text-text-muted hover:text-text">
              ✕
            </button>
          ) : (
            <svg
              className="h-4 w-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Results */}
      {hasSearched && (
        <div className="mt-2 rounded-lg border border-border bg-surface shadow-md">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">
              No products matched — try different words
            </p>
          ) : (
            <ul>
              {results.map((product, i) => (
                <li
                  key={product.id}
                  onClick={() => onResultClick?.(product.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-offset transition-colors ${
                    i !== results.length - 1 ? "border-b border-divider" : ""
                  }`}
                >
                  {/* Thumbnail */}
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-surface-offset flex-shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {product.name}
                    </p>
                    {product.description && (
                      <p className="text-xs text-text-muted truncate">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Match score + price */}
                  <div className="flex-shrink-0 text-right">
                    {product.price && (
                      <p className="text-sm font-medium text-text">
                        ${product.price.toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-text-muted">
                      {Math.round(product.similarity * 100)}% match
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
