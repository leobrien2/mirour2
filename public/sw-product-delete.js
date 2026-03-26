/**
 * sw-product-delete.js
 *
 * Service Worker for background product deletion.
 * Registered by the app; runs independently of the web app lifecycle.
 *
 * Flow:
 *  1. App queues a delete (product ID + auth token) in IndexedDB.
 *  2. App registers Background Sync tag 'product-delete-sync'.
 *  3. This SW fires on that sync event — even if the tab is closed.
 *  4. On each sync, it drains the IndexedDB queue by calling Supabase REST.
 *  5. If a request fails, it leaves it in the queue; the browser retries.
 */

const DB_NAME = "mirour-bg";
const DB_VERSION = 1;
const STORE_NAME = "product-delete-queue";
const SYNC_TAG = "product-delete-sync";

// ─── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllEntries(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteEntry(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Service Worker events ──────────────────────────────────────────────────

// Keep the SW alive for activations
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(self.clients.claim())
);

// Background Sync event — fires even when the tab is closed
self.addEventListener("sync", (e) => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(drainQueue());
  }
});

// ─── Queue drainer ──────────────────────────────────────────────────────────

async function drainQueue() {
  const db = await openDB();
  const entries = await getAllEntries(db);

  for (const entry of entries) {
    const { id, productId, supabaseUrl, supabaseAnonKey, authToken, ownerId } = entry;

    // Build the Supabase REST delete URL.
    // Matches: DELETE /rest/v1/products?id=eq.<productId>&owner_id=eq.<ownerId>
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

      if (res.ok || res.status === 404) {
        // 404 means it was already deleted — either way, remove from queue
        await deleteEntry(db, id);
      } else {
        // Non-retriable HTTP errors (e.g. 401 token expired) — drop to avoid infinite retries
        const body = await res.text().catch(() => "");
        console.error(
          `[sw-product-delete] Failed to delete product ${productId}: HTTP ${res.status}`,
          body
        );
        if (res.status === 401 || res.status === 403) {
          // Token is expired/invalid — can't retry, drop the entry
          await deleteEntry(db, id);
        }
        // For other errors, leave in queue — Background Sync will retry
      }
    } catch (err) {
      // Network error — leave in queue, browser retries
      console.error(`[sw-product-delete] Network error for product ${productId}:`, err);
      throw err; // rethrow so Browser knows to retry this sync
    }
  }
}
