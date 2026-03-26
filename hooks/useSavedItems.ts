"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveItem as dbSave,
  unsaveItem as dbUnsave,
  getSavedItems,
  linkSavedItemsToCustomer,
} from "@/lib/savedItems";
import { SavedItem } from "@/types/mirour";

const localKey = (sid: string) => `mirour:saved:${sid}`;

export interface UseSavedItemsReturn {
  savedItems: SavedItem[];
  savedProductIds: Set<string>;
  loading: boolean;
  isSaved: (productId: string) => boolean;
  toggleSave: (productId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSavedItems(
  sessionId: string | null,
  storeId: string | null | undefined,
  customerId: string | null,
): UseSavedItemsReturn {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const prevCustomerIdRef = useRef<string | null>(null);
  const migrationLockRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const savedProductIds = new Set(savedItems.map((i) => i.product_id));

  // ─── localStorage helpers ──────────────────────────────────────────────────

  const readLocal = useCallback((): string[] => {
    if (!sessionId || typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(localKey(sessionId)) || "[]");
    } catch {
      return [];
    }
  }, [sessionId]);

  const writeLocal = useCallback(
    (ids: string[]) => {
      if (!sessionId || typeof window === "undefined") return;
      localStorage.setItem(localKey(sessionId), JSON.stringify(ids));
    },
    [sessionId],
  );

  // ─── DB load ───────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      // ✅ Fix 1: getSavedItems(sessionId, customerId?) — storeId removed
      const dbItems = await getSavedItems(sessionId, customerId || undefined);

      if (dbItems.length > 0) {
        setSavedItems(dbItems);
        if (!customerId) writeLocal(dbItems.map((i) => i.product_id));
        return;
      }

      // DB empty — check localStorage fallback (anon only)
      if (!customerId) {
        const localIds = readLocal();
        if (localIds.length > 0) {
          setSavedItems(
            localIds.map(
              (pid) =>
                ({
                  id: `local:${pid}`,
                  product_id: pid,
                  session_id: sessionId,
                  customer_id: null,
                  store_id: storeId ?? null,
                  created_at: new Date().toISOString(),
                }) as SavedItem,
            ),
          );
          return;
        }
      }

      setSavedItems([]);
    } catch (e) {
      console.error("useSavedItems load error", e);
    } finally {
      setLoading(false);
      initialLoadDoneRef.current = true;
    }
  }, [sessionId, storeId, customerId, readLocal, writeLocal]);

  // ─── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionId && !initialLoadDoneRef.current) {
      loadItems();
    }
  }, [sessionId, loadItems]);

  // ─── Migration: null → string customerId ──────────────────────────────────

  useEffect(() => {
    const prev = prevCustomerIdRef.current;
    prevCustomerIdRef.current = customerId;

    if (!customerId || prev === customerId) return;
    if (!sessionId || migrationLockRef.current) return;

    migrationLockRef.current = true;
    (async () => {
      try {
        await linkSavedItemsToCustomer(sessionId, customerId);
        await loadItems();
        if (typeof window !== "undefined") {
          localStorage.removeItem(localKey(sessionId));
        }
      } finally {
        migrationLockRef.current = false;
      }
    })();
  }, [customerId, sessionId, loadItems]);

  // ─── Toggle (optimistic) ──────────────────────────────────────────────────

  const toggleSave = useCallback(
    async (productId: string) => {
      if (!sessionId) return;
      const alreadySaved = savedProductIds.has(productId);

      if (alreadySaved) {
        // Optimistic remove
        setSavedItems((prev) => prev.filter((i) => i.product_id !== productId));
        if (!customerId) {
          writeLocal(readLocal().filter((id) => id !== productId));
        }

        // ✅ Fix 2: unsaveItem(sessionId, productId, customerId?) — storeId removed
        const ok = await dbUnsave(
          sessionId,
          productId,
          customerId || undefined,
        );
        if (!ok) {
          await loadItems(); // rollback
        }
      } else {
        const tmpId = `optimistic:${productId}:${Date.now()}`;
        const optimistic: SavedItem = {
          id: tmpId,
          product_id: productId,
          session_id: sessionId,
          customer_id: customerId ?? null,
          store_id: storeId ?? null,
          created_at: new Date().toISOString(),
        } as SavedItem;

        // Optimistic add
        setSavedItems((prev) => [optimistic, ...prev]);
        if (!customerId) {
          const local = readLocal();
          if (!local.includes(productId)) writeLocal([...local, productId]);
        }

        // ✅ Fix 3: saveItem(sessionId, productId, storeId?, customerId?)
        // storeId is now 3rd optional param — coerce null→undefined since it's optional
        const saved = await dbSave(
          sessionId,
          productId,
          storeId ?? undefined,
          customerId || undefined,
        );

        if (saved) {
          // Swap optimistic → real DB row
          setSavedItems((prev) =>
            prev.map((i) => (i.id === tmpId ? saved : i)),
          );
        } else {
          // Rollback
          setSavedItems((prev) => prev.filter((i) => i.id !== tmpId));
          if (!customerId)
            writeLocal(readLocal().filter((id) => id !== productId));
        }
      }
    },
    [
      savedProductIds,
      customerId,
      sessionId,
      storeId,
      readLocal,
      writeLocal,
      loadItems,
    ],
  );

  return {
    savedItems,
    savedProductIds,
    loading,
    isSaved: (pid: string) => savedProductIds.has(pid),
    toggleSave,
    refetch: loadItems,
  };
}
