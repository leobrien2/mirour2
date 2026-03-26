/**
 * lib/product-delete-sync.ts
 *
 * Client-side helpers for the background product-delete system.
 *
 * Usage:
 *   import { registerProductDeleteSW, queueProductDelete } from '@/lib/product-delete-sync';
 *
 *   // Call once on app mount:
 *   registerProductDeleteSW();
 *
 *   // Call instead of direct Supabase delete:
 *   await queueProductDelete(productId, supabaseUrl, anonKey, accessToken, ownerId);
 */

// Background Sync API types (not yet in standard TypeScript lib)
declare global {
  interface SyncManager {
    register(tag: string): Promise<void>;
  }
  interface ServiceWorkerRegistration {
    readonly sync: SyncManager;
  }
  interface Window {
    SyncManager?: typeof Object;
  }
}

const DB_NAME = "mirour-bg";
const DB_VERSION = 1;
const STORE_NAME = "product-delete-queue";
const SYNC_TAG = "product-delete-sync";
const SW_PATH = "/sw-product-delete.js";

// ─── Service Worker registration ────────────────────────────────────────────

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Registers the product-delete service worker.
 * Call this once on app startup. Safe to call multiple times (cached).
 */
export function registerProductDeleteSW(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .then((reg) => {
        console.log("[product-delete-sync] SW registered:", reg.scope);
        return reg;
      })
      .catch((err) => {
        console.error("[product-delete-sync] SW registration failed:", err);
        return null;
      });
  }
}

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result as IDBDatabase);
    req.onerror = () => reject(req.error);
  });
}

interface QueueEntry {
  productId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  authToken: string;
  ownerId: string;
  queuedAt: number;
}

function addToQueue(db: IDBDatabase, entry: QueueEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).add(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Fallback: direct Supabase REST delete ───────────────────────────────────

async function deleteDirectly(
  productId: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  authToken: string,
  ownerId: string
): Promise<{ error: string | null }> {
  const url = new URL(`${supabaseUrl}/rest/v1/products`);
  url.searchParams.set("id", `eq.${productId}`);
  url.searchParams.set("owner_id", `eq.${ownerId}`);

  try {
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
    });

    if (res.ok || res.status === 404) return { error: null };
    const body = await res.text().catch(() => "");
    return { error: `HTTP ${res.status}: ${body}` };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Queues a product deletion for background processing.
 *
 * - If Background Sync is available: writes to IndexedDB + registers sync tag.
 *   The service worker will complete the delete even if the tab is closed.
 * - If not available (Firefox/Safari): falls back to an inline fetch.
 *
 * @returns { error } - null on success (or when queued successfully)
 */
export async function queueProductDelete(
  productId: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  authToken: string,
  ownerId: string
): Promise<{ error: string | null }> {
  const hasBackgroundSync =
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window;

  if (!hasBackgroundSync) {
    // Fallback — direct delete in the current page context
    return deleteDirectly(productId, supabaseUrl, supabaseAnonKey, authToken, ownerId);
  }

  try {
    // Write to IndexedDB queue
    const db = await openDB();
    await addToQueue(db, {
      productId,
      supabaseUrl,
      supabaseAnonKey,
      authToken,
      ownerId,
      queuedAt: Date.now(),
    });

    // Register Background Sync — browser fires 'sync' event when online,
    // even if this tab is already closed.
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register(SYNC_TAG);

    return { error: null };
  } catch (err: unknown) {
    // If queueing itself fails, fall back to direct delete
    console.warn("[product-delete-sync] Queue failed, falling back:", err);
    return deleteDirectly(productId, supabaseUrl, supabaseAnonKey, authToken, ownerId);
  }
}
