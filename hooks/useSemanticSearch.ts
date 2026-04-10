// hooks/useSemanticSearch.ts
import { useState, useCallback, useRef } from "react";

export interface SemanticSearchResult {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  sku: string | null;
  in_stock: boolean;
  similarity: number;
}

interface UseSemanticSearchReturn {
  results: SemanticSearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  hasSearched: boolean;
  search: (q: string, storeId: string) => void;
  clear: () => void;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

export function useSemanticSearch(): UseSemanticSearchReturn {
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const search = useCallback((q: string, storeId: string) => {
    setQuery(q);

    // Clear previous debounce
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Clear results if query too short
    if (!q || q.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/inventory/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q.trim(),
            store_id: storeId,
            limit: 10,
          }),
          signal: abortController.current.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Search failed: ${res.status}`);
        }

        const data = await res.json();
        setResults(data.results || []);
        setHasSearched(true);
      } catch (err: any) {
        if (err.name === "AbortError") return; // stale request, ignore
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const clear = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (abortController.current) abortController.current.abort();
    setResults([]);
    setQuery("");
    setError(null);
    setHasSearched(false);
    setLoading(false);
  }, []);

  return { results, loading, error, query, hasSearched, search, clear };
}
