"use client";

import {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queueProductDelete } from "@/lib/product-delete-sync";
import {
  Store,
  Zone,
  Product,
  Tag,
  StoreIntegration,
  IntegrationPlatform,
} from "@/types/mirour";

/**
 * Strips HTML tags from a string and decodes common HTML entities.
 * Used to sanitize product descriptions imported from CSVs or external systems.
 */
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return (
    html
      // Replace block-level closing tags with a newline so paragraphs separate properly
      .replace(/<\/(p|div|h[1-6]|li|br|section|article|blockquote)>/gi, "\n")
      // Replace <br /> and <br> with a newline
      .replace(/<br\s*\/?>/gi, "\n")
      // Strip all remaining HTML tags
      .replace(/<[^>]+>/g, "")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Collapse multiple blank lines into one
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
}

// ─── Context ──────────────────────────────────────────────────────────────

type StoresContextType = ReturnType<typeof useStoresInternal>;
const StoresContext = createContext<StoresContextType | undefined>(undefined);

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const value = useStoresInternal();
  return (
    <StoresContext.Provider value={value}>{children}</StoresContext.Provider>
  );
}

export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) throw new Error("useStores must be used within a StoresProvider");
  return ctx;
}

// ─── Implementation ────────────────────────────────────────────────────────

function useStoresInternal() {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [integrations, setIntegrations] = useState<StoreIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Fetching ---

  const fetchStores = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("stores" as any)
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStores((data as unknown as Store[]) || []);
    } catch (err: any) {
      console.error("Error fetching stores:", err);
      setError(err.message);
    }
  }, [user]);

  const fetchZones = useCallback(
    async (storeId?: string) => {
      if (!user) return;
      try {
        // Fetch zones with their associated tags via zone_tags junction
        let query = supabase.from("zones" as any).select("*, tags(*)");

        if (storeId) {
          query = query.eq("store_id", storeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (storeId) {
          setZones((prev) => {
            const otherZones = prev.filter((z) => z.store_id !== storeId);
            return [...otherZones, ...((data as unknown as Zone[]) || [])];
          });
        } else {
          setZones((data as unknown as Zone[]) || []);
        }
      } catch (err: any) {
        console.error("Error fetching zones:", err);
      }
    },
    [user],
  );

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    try {
      // Supabase defaults to a maximum of 1,000 rows per query.
      // We paginate using .range() to fetch all products beyond that limit.
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("products" as any)
          .select("*, tags(*), zones(*), store_products(store_id)")
          .eq("owner_id", user.id)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const page = (data as any[]) || [];
        allData = [...allData, ...page];

        // If we got fewer rows than PAGE_SIZE, we've reached the last page.
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Transform the data to include an array of connected store_ids
      const formattedProducts = allData.map((p) => ({
        ...p,
        store_ids: p.store_products
          ? p.store_products.map((sp: any) => sp.store_id)
          : [],
        // Retain store_id as the primary store for legacy support until fully migrated
        store_id:
          p.store_products && p.store_products.length > 0
            ? p.store_products[0].store_id
            : p.store_id,
      }));

      setProducts(formattedProducts as unknown as Product[]);
    } catch (err: any) {
      console.error("Error fetching products:", err);
    }
  }, [user]);

  const fetchTags = useCallback(
    async (storeId?: string) => {
      if (!user) return;
      try {
        let query = supabase
          .from("tags" as any)
          .select("*")
          .eq("owner_id", user.id);

        if (storeId) {
          query = query.eq("store_id", storeId);
        }

        const { data, error } = await query;
        if (error) throw error;
        const fetched = (data as unknown as Tag[]) || [];

        if (storeId) {
          // Merge: replace only this store's tags, keep all others
          setTags((prev) => [
            ...prev.filter((t) => t.store_id !== storeId),
            ...fetched,
          ]);
        } else {
          setTags(fetched);
        }
      } catch (err: any) {
        console.error("Error fetching tags:", err);
      }
    },
    [user],
  );

  const createTag = async (
    storeId: string,
    name: string,
    category?: string,
    isHardConstraint?: boolean,
  ) => {
    try {
      const { data, error } = await supabase
        .from("tags" as any)
        .insert([
          {
            store_id: storeId || null,
            owner_id: user?.id, // ✅ set owner on create
            name,
            category,
            is_hard_constraint: isHardConstraint || false,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      const newTag = data as unknown as Tag;
      setTags((prev) => [...prev, newTag]);
      return { data: newTag, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // Initialize — depend only on user?.id (stable string) so that auth token
  // refreshes (which recreate the user object) don't trigger a full re-fetch.
  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      setIsLoading(true);
      Promise.all([
        fetchStores(),
        fetchZones(),
        fetchProducts(),
        fetchTags(),
      ]).finally(() => setIsLoading(false));
    } else {
      // User signed out – clear all state
      setStores([]);
      setZones([]);
      setProducts([]);
      setTags([]);
      setIntegrations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // --- Mutations ---

  const createStore = async (name: string, location?: string) => {
    if (!user) return { error: "Not authenticated" };
    try {
      const { data, error } = await supabase
        .from("stores" as any)
        .insert([{ owner_id: user.id, name, location }])
        .select()
        .single();

      if (error) throw error;
      const newStore = data as unknown as Store;
      setStores((prev) => [newStore, ...prev]);
      return { data: newStore, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const updateStore = async (id: string, updates: Partial<Store>) => {
    try {
      const { data, error } = await supabase
        .from("stores" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      const updatedStore = data as unknown as Store;
      setStores((prev) => prev.map((s) => (s.id === id ? updatedStore : s)));
      return { data: updatedStore, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const deleteStore = async (id: string) => {
    try {
      const { error } = await supabase
        .from("stores" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setStores((prev) => prev.filter((s) => s.id !== id));
      setZones((prev) => prev.filter((z) => z.store_id !== id));
      setProducts((prev) => prev.filter((p) => p.store_id !== id));
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // Zones
  const createZone = async (
    storeId: string,
    name: string,
    description?: string,
    zoneWhat?: string,
    zoneWhen?: string,
    zoneWho?: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("zones" as any)
        .insert([
          {
            store_id: storeId,
            name,
            description,
            zone_what: zoneWhat || "",
            zone_when: zoneWhen || "",
            zone_who: zoneWho || "",
          },
        ])
        .select()
        .single();
      if (error) throw error;
      const newZone = data as unknown as Zone;
      setZones((prev) => [...prev, newZone]);
      return { data: newZone, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const updateZone = async (id: string, updates: Partial<Zone>) => {
    try {
      const { data, error } = await supabase
        .from("zones" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updatedZone = data as unknown as Zone;
      setZones((prev) => prev.map((z) => (z.id === id ? updatedZone : z)));
      return { data: updatedZone, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const deleteZone = async (id: string) => {
    try {
      const { error } = await supabase
        .from("zones" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      setZones((prev) => prev.filter((z) => z.id !== id));
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // Products
  const createProduct = async (
    storeId: string | null,
    product: Partial<Product>,
  ) => {
    try {
      const { data, error } = await supabase
        .from("products" as any)
        .insert([{ ...product, owner_id: user?.id, store_id: storeId || null }])
        .select()
        .single();
      if (error) throw error;

      const newProduct = data as unknown as Product;

      if (storeId) {
        const { error: spError } = await supabase
          .from("store_products" as any)
          .insert([{ store_id: storeId, product_id: newProduct.id }]);
        if (spError)
          console.error(
            "Failed to link new product to store_products:",
            spError,
          );
      }

      const productWithStores = {
        ...newProduct,
        store_ids: storeId ? [storeId] : [],
      };
      setProducts((prev) => [...prev, productWithStores]);
      return { data: productWithStores, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const { data, error } = await supabase
        .from("products" as any)
        .update(updates)
        .eq("id", id)
        .select("*, tags(*), zones(*), store_products(store_id)")
        .single();
      if (error) throw error;

      const dt = data as any;

      // Transform incoming data to map store_products to store_ids
      const mappedData = {
        ...dt,
        store_ids: dt.store_products
          ? dt.store_products.map((sp: any) => sp.store_id)
          : [],
        store_id:
          dt.store_products && dt.store_products.length > 0
            ? dt.store_products[0].store_id
            : dt.store_id,
      };

      const updatedProduct = mappedData as unknown as Product;
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? updatedProduct : p)),
      );
      return { data: updatedProduct, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user?.id) return { error: "Not authenticated" };

    // ── Optimistic UI update ──────────────────────────────────────────────
    // Remove from local state immediately so the UI feels instant.
    // The actual DB delete happens in the background service worker.
    setProducts((prev) => prev.filter((p) => p.id !== id));

    // ── Background Sync delete ────────────────────────────────────────────
    // Gets the current session token to authenticate the REST call in the SW.
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? "";

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    const { error } = await queueProductDelete(
      id,
      supabaseUrl,
      supabaseAnonKey,
      authToken,
      user.id,
    );

    if (error) {
      // Rollback: restore the product from the server so UI stays consistent
      console.error("[deleteProduct] Background queue failed:", error);
      // Re-fetch just this product to restore it
      try {
        const { data } = await supabase
          .from("products" as any)
          .select("*, tags(*), zones(*), store_products(store_id)")
          .eq("id", id)
          .single();
        if (data) {
          const d = data as any;
          const restored = {
            ...d,
            store_ids: d.store_products?.map((sp: any) => sp.store_id) ?? [],
            store_id: d.store_products?.[0]?.store_id ?? d.store_id,
          };
          setProducts((prev) => [...prev, restored]);
        }
      } catch {
        // ignore restore error
      }
      return { error };
    }

    return { error: null };
  };

  const linkProductToStore = async (productId: string, storeId: string) => {
    try {
      const { error } = await supabase
        .from("store_products" as any)
        .insert([{ store_id: storeId, product_id: productId }]);
      if (error) throw error;

      // Update local state
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === productId) {
            const currentStoreIds = p.store_ids || [];
            return { ...p, store_ids: [...currentStoreIds, storeId] };
          }
          return p;
        }),
      );
      return { error: null };
    } catch (err: any) {
      if (err.code === "23505") return { error: null }; // Ignore duplicates
      return { error: err.message };
    }
  };

  const unlinkProductFromStore = async (productId: string, storeId: string) => {
    try {
      const { error } = await supabase
        .from("store_products" as any)
        .delete()
        .eq("product_id", productId)
        .eq("store_id", storeId);
      if (error) throw error;

      // Update local state
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === productId) {
            const currentStoreIds = p.store_ids || [];
            return {
              ...p,
              store_ids: currentStoreIds.filter((id) => id !== storeId),
            };
          }
          return p;
        }),
      );
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // Tags

  const updateTag = async (tagId: string, updates: Partial<Tag>) => {
    try {
      const { data, error } = await supabase
        .from("tags" as any)
        .update(updates)
        .eq("id", tagId)
        .select()
        .single();
      if (error) throw error;
      const updatedTag = data as unknown as Tag;
      setTags((prev) => prev.map((t) => (t.id === tagId ? updatedTag : t)));
      return { data: updatedTag, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const deleteTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from("tags" as any)
        .delete()
        .eq("id", tagId);
      if (error) throw error;
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const linkTagToProduct = async (productId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from("product_tags" as any)
        .insert([{ product_id: productId, tag_id: tagId }]);
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      // Ignore duplicate key errors if already linked
      if (err.code === "23505") return { error: null };
      return { error: err.message };
    }
  };

  const unlinkTagFromProduct = async (productId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from("product_tags" as any)
        .delete()
        .eq("product_id", productId)
        .eq("tag_id", tagId);
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  /**
   * Re-fetches a single product by ID from the DB and updates local state.
   * Call this after tag link/unlink operations to ensure local state stays
   * in sync with the database (fixing the "product disappears after edit" bug).
   */
  const refreshProduct = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from("products" as any)
        .select("*, tags(*), zones(*), store_products(store_id)")
        .eq("id", productId)
        .single();
      if (error) throw error;
      const dt = data as any;
      const refreshed = {
        ...dt,
        store_ids: dt.store_products
          ? dt.store_products.map((sp: any) => sp.store_id)
          : [],
        store_id:
          dt.store_products && dt.store_products.length > 0
            ? dt.store_products[0].store_id
            : dt.store_id,
      } as unknown as Product;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? refreshed : p)),
      );
      return { data: refreshed, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  // Zone-Tag Management (NEW for Sprint 1B)
  const linkTagToZone = async (zoneId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from("zone_tags" as any)
        .insert([{ zone_id: zoneId, tag_id: tagId }]);
      if (error) throw error;
      // Refresh zones to show updated tags
      await fetchZones();
      return { error: null };
    } catch (err: any) {
      // Ignore duplicate key errors if already linked
      if (err.code === "23505") return { error: null };
      return { error: err.message };
    }
  };

  const unlinkTagFromZone = async (zoneId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from("zone_tags" as any)
        .delete()
        .eq("zone_id", zoneId)
        .eq("tag_id", tagId);
      if (error) throw error;
      // Refresh zones to show updated tags
      await fetchZones();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // --- Integrations ---

  const fetchIntegrations = useCallback(
    async (storeId: string) => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("store_integrations" as any)
          .select("*")
          .eq("store_id", storeId);
        if (error) throw error;
        setIntegrations((prev) => {
          const otherIntegrations = prev.filter((i) => i.store_id !== storeId);
          return [
            ...otherIntegrations,
            ...((data as unknown as StoreIntegration[]) || []),
          ];
        });
      } catch (err: any) {
        console.error("Error fetching integrations:", err);
      }
    },
    [user],
  );

  const saveIntegration = async (
    storeId: string,
    platform: IntegrationPlatform,
    apiKey: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("store_integrations" as any)
        .upsert([{ store_id: storeId, platform, api_key: apiKey }], {
          onConflict: "store_id,platform",
        })
        .select()
        .single();
      if (error) throw error;
      const saved = data as unknown as StoreIntegration;
      setIntegrations((prev) => {
        const others = prev.filter(
          (i) => !(i.store_id === storeId && i.platform === platform),
        );
        return [...others, saved];
      });
      return { data: saved, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const importSquarespaceProducts = async (
    storeId: string,
    apiKey: string,
  ): Promise<{ imported: number; skipped: number; error: string | null }> => {
    try {
      // Call our server-side proxy to avoid CORS and keep key server-side
      const res = await fetch("/api/squarespace/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const { products: sqProducts } = await res.json();

      if (!sqProducts || sqProducts.length === 0) {
        return { imported: 0, skipped: 0, error: null };
      }

      // Fetch existing SKUs for this store to deduplicate
      const { data: existingProducts } = await supabase
        .from("products" as any)
        .select("sku")
        .eq("store_id", storeId);

      const existingSkus = new Set(
        ((existingProducts as any[]) || [])
          .map((p: any) => p.sku)
          .filter(Boolean),
      );

      // Filter out products that already exist
      const toInsert = sqProducts.filter(
        (p: any) => !p.sku || !existingSkus.has(p.sku),
      );

      const skipped = sqProducts.length - toInsert.length;

      if (toInsert.length === 0) {
        return { imported: 0, skipped, error: null };
      }

      // Bulk insert
      const rows = toInsert.map((p: any) => ({
        store_id: storeId,
        name: p.name,
        description: p.description || null,
        image_url: p.image_url || null,
        sku: p.sku || null,
        price: p.price ? parseFloat(p.price) : null,
        in_stock: p.in_stock ?? true,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("products" as any)
        .insert(rows)
        .select();

      if (insertError) throw insertError;

      const newProducts = (inserted as unknown as Product[]) || [];
      setProducts((prev) => [...prev, ...newProducts]);

      return { imported: newProducts.length, skipped, error: null };
    } catch (err: any) {
      return { imported: 0, skipped: 0, error: err.message };
    }
  };

  const importProductsFromFile = async (
    parsedData: any[],
    storeId?: string,
    imageIndex: number = 0,
  ): Promise<{ imported: number; skipped: number; error: string | null }> => {
    try {
      console.log(
        "[import] ▶ START — storeId:",
        storeId,
        "| userId:",
        user?.id,
        "| rows:",
        parsedData?.length,
      );

      if (!user?.id) {
        console.log("[import] ✖ Not authenticated — aborting");
        return { imported: 0, skipped: 0, error: "Not authenticated." };
      }
      if (!parsedData || parsedData.length === 0) {
        console.log("[import] ✖ No parsed data — aborting");
        return { imported: 0, skipped: 0, error: null };
      }

      // Helper function to dynamically find the tag column, regardless of case
      const extractTagsFromRow = (row: any): string => {
        if (!row || typeof row !== "object") return "";
        const tagKey = Object.keys(row).find((key) => {
          const lowerKey = key.toLowerCase().trim();
          return lowerKey === "tag" || lowerKey === "tags";
        });
        return tagKey ? String(row[tagKey] || "") : "";
      };

      let existingProductRows: { sku: string | null; name: string }[] = [];

      if (storeId) {
        console.log(
          "[import] 🔍 DEDUP MODE: by storeId:",
          storeId,
          "+ owner_id:",
          user.id,
        );

        const { data: byStoreId, error: e1 } = await supabase
          .from("products" as any)
          .select("sku, name")
          .eq("store_id", storeId)
          .eq("owner_id", user.id);

        const { data: byJunction, error: e2 } = await supabase
          .from("store_products" as any)
          .select("products!inner(sku, name, owner_id)")
          .eq("store_id", storeId)
          .eq("products.owner_id", user.id);

        const junctionRows = ((byJunction as any[]) || [])
          .map((r: any) => r.products)
          .filter(Boolean);

        const merged = new Map<string, { sku: string | null; name: string }>();
        [...((byStoreId as any[]) || []), ...junctionRows].forEach((p: any) => {
          if (p?.name) merged.set(p.name, p);
        });
        existingProductRows = Array.from(merged.values());
      } else {
        console.log("[import] 🔍 DEDUP MODE: global — owner_id:", user.id);
        const { data, error: e3 } = await supabase
          .from("products" as any)
          .select("sku, name")
          .eq("owner_id", user.id);
        existingProductRows = (data as any[]) || [];
      }

      const existingSkus = new Set(
        existingProductRows.map((p) => p.sku).filter(Boolean),
      );
      const existingNames = new Set(
        existingProductRows.map((p) => p.name).filter(Boolean),
      );

      let tagsQuery = supabase
        .from("tags" as any)
        .select("*")
        .eq("owner_id", user.id);
      if (storeId) {
        tagsQuery = tagsQuery.eq("store_id", storeId);
      }
      const { data: existingTagsData } = await tagsQuery;

      const existingTagsMap = new Map(
        ((existingTagsData as unknown as Tag[]) || []).map((t) => [
          t.name.toLowerCase(),
          t,
        ]),
      );

      const toInsert: any[] = [];
      const isShopifyFormat =
        parsedData.length > 0 && "Handle" in parsedData[0];
      let normalizedRows: any[] = parsedData;

      if (isShopifyFormat) {
        const handleMap = new Map<string, any>();

        for (const row of parsedData) {
          const handle = row["Handle"];
          if (!handle) continue;

          if (!handleMap.has(handle)) {
            handleMap.set(handle, {
              name: row["Title"] || "",
              sku: row["Variant SKU"] || "",
              price: row["Variant Price"] || "",
              description: row["Body (HTML)"] || "",
              image_url: row["Image Src"] || "",
              tags: extractTagsFromRow(row), // Using dynamic extraction
              in_stock: (row["Status"] || "").toLowerCase() === "active",
            });
          } else {
            const merged = handleMap.get(handle)!;
            if (!merged.sku && row["Variant SKU"])
              merged.sku = row["Variant SKU"];
            if (!merged.price && row["Variant Price"])
              merged.price = row["Variant Price"];
            if (!merged.description && row["Body (HTML)"])
              merged.description = row["Body (HTML)"];

            const currentTags = extractTagsFromRow(row); // Using dynamic extraction
            if (!merged.tags && currentTags) merged.tags = currentTags;

            if (!merged.image_url || row["Image Position"] === "1")
              if (row["Image Src"]) merged.image_url = row["Image Src"];
          }
        }
        normalizedRows = Array.from(handleMap.values()).filter((r) => r.name);
      }

      for (const row of normalizedRows) {
        const name =
          row.name ||
          row.product_name ||
          row.Name ||
          row["Product Name"] ||
          row.Title ||
          row.title ||
          row.composite_name;
        const sku =
          row.sku || row.SKU || row["Variant SKU"] || row.composite_sku;
        if (!name) continue;

        const isDuplicate = sku
          ? existingSkus.has(sku)
          : existingNames.has(name);
        if (isDuplicate) continue;

        const priceStr =
          row.price ||
          row.retail_price ||
          row.Price ||
          row["Variant Price"] ||
          "";
        const price = String(priceStr).replace(/[^0-9.]/g, "");
        const rawDescription =
          row.description || row.Description || row["Body (HTML)"] || null;
        const description = stripHtml(rawDescription);
        // Lightspeed (and some other POS systems) may store multiple comma-
        // separated image URLs in a single quoted field. We pick the URL at
        // imageIndex (0-based), falling back to the first if out of range.
        const rawImageUrl =
          row.image_url || row["Image URL"] || row["Image Src"] || null;
        const imageUrl = rawImageUrl
          ? ((String(rawImageUrl).split(",").map((u: string) => u.trim()).filter(Boolean)[imageIndex]
              ?? String(rawImageUrl).split(",")[0].trim()) || null)
          : null;

        let inStock = true;
        // Lightspeed: `active` column (1 = active/in-stock, 0 = inactive)
        if (row.active !== undefined && row.active !== "") {
          inStock = String(row.active).trim() === "1";
        } else if (row.in_stock !== undefined) {
          inStock = Boolean(row.in_stock);
        }
        if (
          row.inventory_quantity !== undefined ||
          row.stock_quantity !== undefined
        ) {
          const qty = parseInt(
            row.inventory_quantity || row.stock_quantity || "0",
            10,
          );
          inStock = qty > 0;
        }

        toInsert.push({
          raw: row,
          dbRow: {
            store_id: storeId || null,
            owner_id: user?.id,
            name,
            description,
            image_url: imageUrl,
            sku: sku || null,
            price: price ? parseFloat(price) : null,
            in_stock: inStock,
          },
        });
      }

      const totalDistinct = isShopifyFormat
        ? normalizedRows.length
        : parsedData.length;
      const skipped = totalDistinct - toInsert.length;

      if (toInsert.length === 0) {
        return { imported: 0, skipped, error: null };
      }

      const { data: insertedProducts, error: insertError } = await supabase
        .from("products" as any)
        .insert(toInsert.map((t) => t.dbRow))
        .select();

      if (insertError) throw insertError;

      const newProducts = (insertedProducts as unknown as Product[]) || [];

      if (storeId && newProducts.length > 0) {
        const storeProductsToInsert = newProducts.map((p) => ({
          store_id: storeId,
          product_id: p.id,
        }));
        const { error: spError } = await supabase
          .from("store_products" as any)
          .upsert(storeProductsToInsert, {
            onConflict: "store_id, product_id",
            ignoreDuplicates: true,
          });
        if (spError) {
          console.error("[import] ⚠️ store_products link failed:", spError);
        }
        newProducts.forEach((p) => {
          p.store_ids = [storeId];
        });
      } else {
        newProducts.forEach((p) => {
          p.store_ids = [];
        });
      }

      setProducts((prev) => [...prev, ...newProducts]);

      // Process Tags
      const productTagsToInsert: { product_id: string; tag_id: string }[] = [];
      const newTagsToInsertMap = new Map<string, string>();

      // Collect new tags
      toInsert.forEach((item) => {
        const tagsStr = extractTagsFromRow(item.raw); // Using dynamic extraction
        if (tagsStr && typeof tagsStr === "string") {
          const rowTags = tagsStr
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
          rowTags.forEach((t: string) => {
            const tl = t.toLowerCase();
            if (!existingTagsMap.has(tl) && !newTagsToInsertMap.has(tl)) {
              newTagsToInsertMap.set(tl, t);
            }
          });
        }
      });

      // Create new tags
      if (newTagsToInsertMap.size > 0) {
        // ✅ removed storeId check
        const tagsToInsertDb = Array.from(newTagsToInsertMap.values()).map(
          (tagName) => ({
            store_id: storeId || null, // ✅ null if no store, that's fine
            owner_id: user?.id,
            name: tagName,
            is_hard_constraint: false,
          }),
        );
        // ...

        const { data: insertedTags, error: tagsInsertError } = await supabase
          .from("tags" as any)
          .insert(tagsToInsertDb)
          .select();

        if (!tagsInsertError && insertedTags) {
          (insertedTags as unknown as Tag[]).forEach((t) => {
            existingTagsMap.set(t.name.toLowerCase(), t);
          });
          setTags((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTs = (insertedTags as unknown as Tag[]).filter(
              (t) => !existingIds.has(t.id),
            );
            return [...prev, ...newTs];
          });
        }
      }

      // Build a fast lookup: (name::sku) → raw CSV row so we can match
      // inserted products back to their source rows regardless of return order.
      const rawRowByKey = new Map<string, any>();
      toInsert.forEach((item) => {
        const key = `${item.dbRow.name}::${item.dbRow.sku ?? ""}`;
        rawRowByKey.set(key, item.raw);
      });

      // Create product-tag relationships
      newProducts.forEach((product) => {
        const key = `${product.name}::${product.sku ?? ""}`;
        const rawRow = rawRowByKey.get(key);
        if (!rawRow) return;

        const tagsStr = extractTagsFromRow(rawRow);
        if (tagsStr && typeof tagsStr === "string") {
          const rowTags = Array.from(
            new Set(
              tagsStr
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
            ),
          );
          rowTags.forEach((tagStr: string) => {
            const tagObj = existingTagsMap.get(tagStr.toLowerCase());
            if (tagObj) {
              productTagsToInsert.push({
                product_id: product.id,
                tag_id: tagObj.id,
              });
            }
          });
        }
      });

      if (productTagsToInsert.length > 0) {
        const { error: ptError } = await supabase
          .from("product_tags" as any)
          .upsert(productTagsToInsert, {
            onConflict: "product_id, tag_id",
            ignoreDuplicates: true,
          });
        if (ptError) {
          console.error("[import] ⚠️ product_tags insert failed:", ptError);
        } else {
          console.log(
            `[import] ✅ linked ${productTagsToInsert.length} product-tag entries`,
          );
        }
      }

      await fetchProducts();

      return { imported: newProducts.length, skipped, error: null };
    } catch (err: any) {
      console.error("[import] 💥 CAUGHT ERROR:", err);
      return {
        imported: 0,
        skipped: 0,
        error: err.message || "Failed to import products.",
      };
    }
  };

  return {
    stores,
    zones,
    products,
    tags,
    integrations,
    isLoading,
    error,
    fetchStores,
    fetchProducts,
    createStore,
    updateStore,
    deleteStore,
    createZone,
    updateZone,
    deleteZone,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshProduct,
    createTag,
    updateTag,
    deleteTag,
    fetchTags,
    linkTagToProduct,
    unlinkTagFromProduct,
    linkTagToZone,
    unlinkTagFromZone,
    fetchIntegrations,
    saveIntegration,
    importSquarespaceProducts,
    importProductsFromFile,
    linkProductToStore,
    unlinkProductFromStore,
  };
}
