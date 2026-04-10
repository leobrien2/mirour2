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
import {
  Store,
  Zone,
  Product,
  Tag,
  StoreIntegration,
  IntegrationPlatform,
} from "@/types/mirour";
import { flowLog } from "@/lib/flowLogger";

// ─── Constants ─────────────────────────────────────────────────────────────

const PRODUCT_PAGE_SIZE = 8;
const DELETE_CHUNK_SIZE = 100;
const IMPORT_BATCH_SIZE = 500;

// ─── Helpers ───────────────────────────────────────────────────────────────

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return (
    html
      .replace(/<\/(p|div|h[1-6]|li|br|section|article|blockquote)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Filter Interfaces ─────────────────────────────────────────────────────

export interface ProductFilters {
  search?: string;
  zoneId?: string;
  tagId?: string;
  storeId?: string;
  page?: number; // Added for robust pagination
}

// ─── Context ───────────────────────────────────────────────────────────────

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

  // ── Counts ───────────────────────────────────────────────────────────────
  const [productCount, setProductCount] = useState<number>(0);
  const [tagCount, setTagCount] = useState<number>(0);

  // ── Loading state ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Query Builder Helper ────────────────────────────────────────────────
  const applyProductFilters = (query: any, filters: ProductFilters) => {
    let q = query;
    if (filters.search) {
      q = q.or(
        `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
      );
    }
    if (filters.zoneId && filters.zoneId !== "all") {
      if (filters.zoneId === "none") q = q.is("zone_id", null);
      else q = q.eq("zone_id", filters.zoneId);
    }
    if (filters.tagId && filters.tagId !== "all" && filters.tagId !== "none") {
      q = q.eq("tags.id", filters.tagId);
    }
    if (
      filters.storeId &&
      filters.storeId !== "all" &&
      filters.storeId !== "none"
    ) {
      q = q.eq("store_products.store_id", filters.storeId);
    }
    return q;
  };

  const getSelectQuery = (filters: ProductFilters) => {
    const tagJoin =
      filters.tagId && filters.tagId !== "all" && filters.tagId !== "none"
        ? "tags!inner(*)"
        : "tags(*)";
    const storeJoin =
      filters.storeId && filters.storeId !== "all" && filters.storeId !== "none"
        ? "store_products!inner(store_id)"
        : "store_products(store_id)";
    return `*, ${tagJoin}, zones(*), ${storeJoin}`;
  };

  // ─── Fetch: Stores ────────────────────────────────────────────────────────

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

  // ─── Fetch: Zones ─────────────────────────────────────────────────────────

  const fetchZones = useCallback(
    async (storeId?: string) => {
      if (!user) return;
      try {
        let query = supabase.from("zones" as any).select("*, tags(*)");
        if (storeId) query = query.eq("store_id", storeId);
        const { data, error } = await query;
        if (error) throw error;
        if (storeId) {
          setZones((prev) => {
            const others = prev.filter((z) => z.store_id !== storeId);
            return [...others, ...((data as unknown as Zone[]) || [])];
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

  // ─── Fetch: Product Count (Server-Side Filtered) ─────────────────────────

  const fetchProductCount = useCallback(
    async (filters: ProductFilters = {}) => {
      if (!user) return;
      try {
        const selectQuery = getSelectQuery(filters);
        let query = supabase
          .from("products" as any)
          .select(selectQuery, { count: "exact", head: true })
          .eq("owner_id", user.id);

        query = applyProductFilters(query, filters);

        const { count, error } = await query;
        if (error) throw error;
        setProductCount(count ?? 0);
      } catch (err: any) {
        console.error("Error fetching product count:", err);
      }
    },
    [user],
  );

  const fetchTagCount = useCallback(
    async (storeId?: string) => {
      if (!user) return;
      try {
        let query = supabase
          .from("tags" as any)
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id);
        if (storeId) query = query.eq("store_id", storeId);
        const { count, error } = await query;
        if (error) throw error;
        setTagCount(count ?? 0);
      } catch (err: any) {
        console.error("Error fetching tag count:", err);
      }
    },
    [user],
  );

  // ─── Fetch: Products (Server-Side Filtered + Paginated) ──────────────────

  const fetchProducts = useCallback(
    async (filters: ProductFilters = {}) => {
      if (!user) return;
      setIsProductsLoading(true);
      try {
        const page = filters.page || 1;
        const from = (page - 1) * PRODUCT_PAGE_SIZE;
        const to = from + PRODUCT_PAGE_SIZE - 1;

        const selectQuery = getSelectQuery(filters);
        let query = supabase
          .from("products" as any)
          .select(selectQuery)
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, to);

        query = applyProductFilters(query, filters);

        const { data, error } = await query;
        if (error) throw error;

        const pageData = (data as any[]) || [];
        const formatted = pageData.map((p) => ({
          ...p,
          store_ids: p.store_products?.map((sp: any) => sp.store_id) ?? [],
          store_id: p.store_products?.[0]?.store_id ?? p.store_id,
        }));

        setProducts(formatted as unknown as Product[]);
      } catch (err: any) {
        console.error("Error fetching products:", err);
      } finally {
        setIsProductsLoading(false);
      }
    },
    [user],
  );

  // ─── Fetch: Tags ─────────────────────────────────────────────────────────

  const fetchTags = useCallback(
    async (storeId?: string) => {
      if (!user) return;
      try {
        const PAGE_SIZE = 1000;
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from("tags" as any)
            .select("*")
            .eq("owner_id", user.id)
            .order("name", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
          if (storeId) query = query.eq("store_id", storeId);
          const { data, error } = await query;
          if (error) throw error;
          const page = (data as any[]) || [];
          allData = [...allData, ...page];
          hasMore = page.length === PAGE_SIZE;
          from += PAGE_SIZE;
        }

        const fetched = (allData as unknown as Tag[]) || [];
        if (storeId) {
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

  // ─── Init ────────────────────────────────────────────────────────────────

  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      setIsLoading(true);
      Promise.all([
        fetchStores(),
        fetchZones(),
        fetchProducts({ page: 1 }),
        fetchTags(),
        fetchProductCount({}),
        fetchTagCount(),
        fetchIntegrations(),
      ]).finally(() => setIsLoading(false));
    } else {
      setStores([]);
      setZones([]);
      setProducts([]);
      setTags([]);
      setIntegrations([]);
      setProductCount(0);
      setTagCount(0);
    }
  }, [userId]);

  // ─── Mutations: Stores ────────────────────────────────────────────────────

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
      const updated = data as unknown as Store;
      setStores((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return { data: updated, error: null };
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
      setProducts((prev) => {
        const removed = prev.filter((p) => p.store_id === id).length;
        setProductCount((c) => Math.max(0, c - removed));
        return prev.filter((p) => p.store_id !== id);
      });
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // ─── Mutations: Zones ─────────────────────────────────────────────────────

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
      const updated = data as unknown as Zone;
      setZones((prev) => prev.map((z) => (z.id === id ? updated : z)));
      return { data: updated, error: null };
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

  // ─── Mutations: Products ──────────────────────────────────────────────────

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

      const withStores = { ...newProduct, store_ids: storeId ? [storeId] : [] };
      setProducts((prev) => {
        if (prev.length < PRODUCT_PAGE_SIZE) return [withStores, ...prev];
        return prev;
      });
      setProductCount((c) => c + 1);

      triggerEmbedding(newProduct.id);

      return { data: withStores, error: null };
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
      const mapped = {
        ...dt,
        store_ids: dt.store_products?.map((sp: any) => sp.store_id) ?? [],
        store_id: dt.store_products?.[0]?.store_id ?? dt.store_id,
      } as unknown as Product;
      setProducts((prev) => prev.map((p) => (p.id === id ? mapped : p)));

      const needsReEmbed = "name" in updates || "description" in updates;
      if (needsReEmbed) triggerEmbedding(id);

      return { data: mapped, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user?.id) return { error: "Not authenticated" };

    setProducts((prev) => prev.filter((p) => p.id !== id));
    setProductCount((c) => Math.max(0, c - 1));

    try {
      const { error } = await supabase
        .from("products" as any)
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      console.error("[deleteProduct] failed:", err);
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
          setProducts((prev) => [restored, ...prev]);
          setProductCount((c) => c + 1);
        }
      } catch {}
      return { error: err.message };
    }
  };

  const deleteAllProductsByOwner = async (storeId?: string) => {
    if (!user?.id) return { error: "Not authenticated" };
    try {
      if (storeId) {
        const { data: spRows, error: spErr } = await supabase
          .from("store_products" as any)
          .select("product_id")
          .eq("store_id", storeId);
        if (spErr) throw spErr;

        const ids = ((spRows as any[]) || []).map((r: any) => r.product_id);
        if (ids.length > 0) {
          const chunks = chunkArray(ids, DELETE_CHUNK_SIZE);
          const results = await Promise.all(
            chunks.map((chunk) =>
              supabase
                .from("products" as any)
                .delete()
                .in("id", chunk)
                .eq("owner_id", user.id),
            ),
          );
          const failed = results.find((r) => r.error);
          if (failed?.error) throw failed.error;
        }
        setProducts((prev) =>
          prev.filter((p) => !p.store_ids?.includes(storeId)),
        );
        await fetchProductCount();
      } else {
        const { error } = await supabase
          .from("products" as any)
          .delete()
          .eq("owner_id", user.id);
        if (error) throw error;
        setProducts([]);
        setProductCount(0);
      }
      return { error: null };
    } catch (err: any) {
      console.error("[deleteAllProducts] failed:", err);
      return { error: err.message };
    }
  };

  const linkProductToStore = async (productId: string, storeId: string) => {
    try {
      const { error } = await supabase
        .from("store_products" as any)
        .insert([{ store_id: storeId, product_id: productId }]);
      if (error) throw error;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, store_ids: [...(p.store_ids || []), storeId] }
            : p,
        ),
      );
      return { error: null };
    } catch (err: any) {
      if (err.code === "23505") return { error: null };
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
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                store_ids: (p.store_ids || []).filter((id) => id !== storeId),
              }
            : p,
        ),
      );
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

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
        store_ids: dt.store_products?.map((sp: any) => sp.store_id) ?? [],
        store_id: dt.store_products?.[0]?.store_id ?? dt.store_id,
      } as unknown as Product;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? refreshed : p)),
      );
      return { data: refreshed, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  // ─── Mutations: Tags ──────────────────────────────────────────────────────

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
            owner_id: user?.id,
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
      setTagCount((c) => c + 1);
      return { data: newTag, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const updateTag = async (tagId: string, updates: Partial<Tag>) => {
    try {
      const { data, error } = await supabase
        .from("tags" as any)
        .update(updates)
        .eq("id", tagId)
        .select()
        .single();
      if (error) throw error;
      const updated = data as unknown as Tag;
      setTags((prev) => prev.map((t) => (t.id === tagId ? updated : t)));
      return { data: updated, error: null };
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
      setTagCount((c) => Math.max(0, c - 1));
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const bulkDeleteTags = async (tagIds: string[]) => {
    if (tagIds.length === 0) return { error: null };
    try {
      const chunks = chunkArray(tagIds, DELETE_CHUNK_SIZE);
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from("tags" as any)
            .delete()
            .in("id", chunk),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      setTags((prev) => prev.filter((t) => !tagIds.includes(t.id)));
      setTagCount((c) => Math.max(0, c - tagIds.length));
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const deleteAllTagsByOwner = async (storeId?: string) => {
    if (!user) return { error: "Not authenticated" };
    try {
      let query = supabase
        .from("tags" as any)
        .delete()
        .eq("owner_id", user.id);
      if (storeId) query = query.eq("store_id", storeId);
      const { error } = await query;
      if (error) throw error;

      if (storeId) {
        setTags((prev) => prev.filter((t) => t.store_id !== storeId));
        await fetchTagCount();
      } else {
        setTags([]);
        setTagCount(0);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const clearAllOrphanTags = async () => {
    if (!user) return { error: "Not authenticated" };
    try {
      const { error } = await supabase
        .from("tags" as any)
        .delete()
        .is("store_id", null)
        .eq("owner_id", user.id);
      if (error) throw error;
      const orphanCount = tags.filter((t) => t.store_id === null).length;
      setTags((prev) => prev.filter((t) => t.store_id !== null));
      setTagCount((c) => Math.max(0, c - orphanCount));
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

  // ─── Zone-Tag Management ──────────────────────────────────────────────────

  const linkTagToZone = async (zoneId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from("zone_tags" as any)
        .insert([{ zone_id: zoneId, tag_id: tagId }]);
      if (error) throw error;
      await fetchZones();
      return { error: null };
    } catch (err: any) {
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
      await fetchZones();
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };


  const fetchIntegrations = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("store_integrations" as any)
        .select("*")
        .eq("owner_id", user.id);

      if (error) throw error;

      setIntegrations((data as unknown as StoreIntegration[]) || []);
    } catch (err: any) {
      console.error("Error fetching integrations:", err);
    }
  }, [user]);

  const connectNango = async (
    storeId: string | undefined, // Make optional
    platform: "shopify" | "squarespace" | "lightspeed-retail",
    shopDomain?: string,
  ): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not authenticated" };

    try {
      const connectionId = `${user.id}-${platform}`;

      const sessionRes = await fetch("/api/nango/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      const sessionData = await sessionRes.json();
      if (sessionData.error) throw new Error(sessionData.error);

      const { connectSessionToken } = sessionData;

      const NangoFrontend = (await import("@nangohq/frontend")).default;
      const nangoClient = new NangoFrontend({ connectSessionToken });

      let authParams = undefined;

      if (platform === "shopify" && shopDomain) {
        let cleanDomain = shopDomain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "");
        let subdomain = cleanDomain;
        if (cleanDomain.includes(".myshopify.com")) {
          subdomain = cleanDomain.split(".myshopify.com")[0];
        }
        authParams = { params: { subdomain: subdomain } };
      }

      let authResult: any;
      try {
        authResult = await nangoClient.auth(platform, authParams as any);
      } catch (authErr: any) {
        return { error: authErr.message || "OAuth was cancelled or failed" };
      }

      const generatedConnectionId = authResult.connectionId;

      const result = await saveIntegration(
        storeId,
        platform as IntegrationPlatform,
        generatedConnectionId,
      );

      return { error: result.error ?? null };
    } catch (err: any) {
      return { error: err.message || "OAuth connection failed" };
    }
  };

  const saveIntegration = async (
    storeId: string | undefined, // Make optional
    platform: IntegrationPlatform,
    apiKey: string,
  ) => {
    if (!user) return { error: "Not authenticated" };

    try {
      const payload = {
        owner_id: user.id,
        platform,
        api_key: apiKey,
        store_id: storeId || null, // Pass null instead of "global"
      };

      const { data, error } = await supabase
        .from("store_integrations" as any)
        .upsert([payload], {
          onConflict: "owner_id, platform",
        })
        .select()
        .single();

      if (error) throw error;

      const saved = data as unknown as StoreIntegration;

      setIntegrations((prev) => {
        const others = prev.filter((i) => i.platform !== platform);
        return [...others, saved];
      });

      return { data: saved, error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const saveWebhookUrl = async (storeId: string | undefined, url: string) => {
    return await saveIntegration(
      storeId,
      "webhook" as IntegrationPlatform,
      url,
    );
  };

  // ─── Import: Squarespace ──────────────────────────────────────────────────

  const importSquarespaceProducts = async (
    storeId: string,
    apiKey: string,
  ): Promise<{ imported: number; skipped: number; error: string | null }> => {
    try {
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

      const { data: existing } = await supabase
        .from("products" as any)
        .select("sku")
        .eq("store_id", storeId);
      const existingSkus = new Set(
        ((existing as any[]) || []).map((p: any) => p.sku).filter(Boolean),
      );

      const toInsert = sqProducts.filter(
        (p: any) => !p.sku || !existingSkus.has(p.sku),
      );
      const skipped = sqProducts.length - toInsert.length;
      if (toInsert.length === 0) return { imported: 0, skipped, error: null };

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
      setProductCount((c) => c + newProducts.length);
      return { imported: newProducts.length, skipped, error: null };
    } catch (err: any) {
      return { imported: 0, skipped: 0, error: err.message };
    }
  };

  // ─── Import: File (CSV / Shopify / Lightspeed) — HIGH SPEED BATCHING ──────

  const importProductsFromFile = async (
    parsedData: any[],
    storeId?: string,
    imageIndex: number = 0,
  ): Promise<{ imported: number; skipped: number; error: string | null }> => {
    try {
      flowLog(
        "IMPORT_START",
        { storeId, parsedRows: parsedData?.length },
        "info",
      );

      if (!user?.id) {
        flowLog("IMPORT_FAILED", { reason: "Not authenticated" }, "error");
        return { imported: 0, skipped: 0, error: "Not authenticated." };
      }
      if (!parsedData || parsedData.length === 0) {
        flowLog("IMPORT_SKIPPED", { reason: "Empty parsed data" }, "info");
        return { imported: 0, skipped: 0, error: null };
      }

      const extractTagsFromRow = (row: any): string[] => {
        if (!row || typeof row !== "object") return [];
        const tagKeys = Object.keys(row).filter((key) => {
          const lk = key.toLowerCase().trim();
          return lk === "tag" || lk === "tags" || lk === "generated_tags";
        });
        if (tagKeys.length === 0) return [];

        const allTags: string[] = [];
        tagKeys.forEach((tagKey) => {
          const rawValue = row[tagKey];
          if (rawValue === undefined || rawValue === null) return;
          if (Array.isArray(rawValue)) {
            rawValue.forEach((t) => {
              const s = String(t).trim();
              if (s) allTags.push(s);
            });
            return;
          }
          const rawTags = String(rawValue).trim();
          if (!rawTags) return;
          if (rawTags.startsWith("[") && rawTags.endsWith("]")) {
            try {
              const parsed = JSON.parse(rawTags);
              if (Array.isArray(parsed)) {
                parsed.forEach((t) => {
                  const s = String(t).trim();
                  if (s) allTags.push(s);
                });
                return;
              }
            } catch (e) {}
          }
          const cleanedString = rawTags.replace(/[\[\]"']/g, "");
          cleanedString
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .forEach((t) => allTags.push(t));
        });
        return Array.from(new Set(allTags));
      };

      flowLog("FETCH_EXISTING_PRODUCTS", { storeId }, "db_read", "products");
      const existingSkus = new Set<string>();
      const existingNames = new Set<string>();

      let pFetchFrom = 0;
      let pFetching = true;

      while (pFetching) {
        const { data, error } = await supabase
          .from("products" as any)
          .select("sku, name, store_id, store_products(store_id)")
          .eq("owner_id", user.id)
          .range(pFetchFrom, pFetchFrom + 999);

        if (error || !data || data.length === 0) break;

        for (const p of data as any[]) {
          const sIds = [
            p.store_id,
            ...(p.store_products || []).map((sp: any) => sp.store_id),
          ];
          if (!storeId || sIds.includes(storeId)) {
            if (p.sku) existingSkus.add(p.sku);
            if (p.name) existingNames.add(p.name);
          }
        }
        if (data.length < 1000) break;
        pFetchFrom += 1000;
      }

      flowLog(
        "DEDUP_MAP_BUILT",
        { skus: existingSkus.size, names: existingNames.size },
        "info",
      );

      let allExistingTags: any[] = [];
      let fetchFrom = 0;
      const fetchLimit = 1000;
      let isFetchingTags = true;

      while (isFetchingTags) {
        let tagsQuery = supabase
          .from("tags" as any)
          .select("*")
          .eq("owner_id", user.id)
          .range(fetchFrom, fetchFrom + fetchLimit - 1);
        if (storeId) tagsQuery = tagsQuery.eq("store_id", storeId);

        const { data: tagsPage, error: fetchErr } = await tagsQuery;
        if (fetchErr) {
          flowLog("FETCH_TAGS_ERROR", fetchErr, "error", "tags");
          break;
        }

        if (tagsPage && tagsPage.length > 0) {
          allExistingTags = [...allExistingTags, ...tagsPage];
          fetchFrom += fetchLimit;
        } else {
          isFetchingTags = false;
        }
      }

      flowLog(
        "FETCHED_EXISTING_TAGS",
        { count: allExistingTags.length },
        "db_read",
        "tags",
      );
      const existingTagsMap = new Map(
        (allExistingTags as unknown as Tag[]).map((t) => [
          t.name.toLowerCase().trim(),
          t,
        ]),
      );

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
              tags: extractTagsFromRow(row),
              in_stock: (row["Status"] || "").toLowerCase() === "active",
            });
          } else {
            const m = handleMap.get(handle)!;
            if (!m.sku && row["Variant SKU"]) m.sku = row["Variant SKU"];
            if (!m.price && row["Variant Price"])
              m.price = row["Variant Price"];
            if (!m.description && row["Body (HTML)"])
              m.description = row["Body (HTML)"];
            const nextTags = extractTagsFromRow(row);
            if (nextTags.length > 0)
              m.tags = Array.from(new Set([...(m.tags || []), ...nextTags]));
            if (!m.image_url || row["Image Position"] === "1") {
              if (row["Image Src"]) m.image_url = row["Image Src"];
            }
          }
        }
        normalizedRows = Array.from(handleMap.values()).filter((r) => r.name);
      }

      const toInsert: any[] = [];
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
        const description = stripHtml(
          row.description || row.Description || row["Body (HTML)"] || null,
        );
        const rawImg =
          row.image_url || row["Image URL"] || row["Image Src"] || null;
        const imageUrl = rawImg
          ? (String(rawImg)
              .split(",")
              .map((u: string) => u.trim())
              .filter(Boolean)[imageIndex] ??
              String(rawImg).split(",")[0].trim()) ||
            null
          : null;

        let inStock = true;
        if (row.active !== undefined && row.active !== "")
          inStock = String(row.active).trim() === "1";
        else if (row.in_stock !== undefined) inStock = Boolean(row.in_stock);
        if (
          row.inventory_quantity !== undefined ||
          row.stock_quantity !== undefined
        ) {
          inStock =
            parseInt(row.inventory_quantity || row.stock_quantity || "0", 10) >
            0;
        }

        const tags = isShopifyFormat ? row.tags || [] : extractTagsFromRow(row);

        toInsert.push({
          raw: row,
          tags,
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

      if (toInsert.length === 0) return { imported: 0, skipped, error: null };

      const newProducts: Product[] = [];
      for (let i = 0; i < toInsert.length; i += IMPORT_BATCH_SIZE) {
        const chunk = toInsert.slice(i, i + IMPORT_BATCH_SIZE);
        const { data: insertedChunk, error: insertError } = await supabase
          .from("products" as any)
          .insert(chunk.map((t) => t.dbRow))
          .select();

        if (insertError) throw insertError;
        if (insertedChunk)
          newProducts.push(...(insertedChunk as unknown as Product[]));
      }
      flowLog(
        "PRODUCTS_INSERTED",
        { count: newProducts.length },
        "db_write",
        "products",
      );

      if (storeId && newProducts.length > 0) {
        const spRows = newProducts.map((p) => ({
          store_id: storeId,
          product_id: p.id,
        }));
        for (let i = 0; i < spRows.length; i += IMPORT_BATCH_SIZE) {
          const chunk = spRows.slice(i, i + IMPORT_BATCH_SIZE);
          await supabase.from("store_products" as any).upsert(chunk, {
            onConflict: "store_id, product_id",
            ignoreDuplicates: true,
          });
        }
        newProducts.forEach((p) => {
          p.store_ids = [storeId];
        });
      } else {
        newProducts.forEach((p) => {
          p.store_ids = [];
        });
      }

      const productTagsToInsert: { product_id: string; tag_id: string }[] = [];
      const newTagsMap = new Map<string, string>();

      toInsert.forEach((item) => {
        const tagsArray = item.tags || [];
        tagsArray.forEach((t: string) => {
          const tl = t.toLowerCase().trim();
          if (!existingTagsMap.has(tl) && !newTagsMap.has(tl)) {
            newTagsMap.set(tl, t.trim());
          }
        });
      });

      const successfulNewTags: Tag[] = [];

      if (newTagsMap.size > 0) {
        const tagNamesToInsert = Array.from(newTagsMap.values());
        const tagChunks = chunkArray(tagNamesToInsert, IMPORT_BATCH_SIZE);

        for (const chunk of tagChunks) {
          const payload = chunk.map((tagName) => ({
            store_id: storeId || null,
            owner_id: user?.id,
            name: tagName,
            is_hard_constraint: false,
          }));

          const { data: bulkData, error: bulkError } = await supabase
            .from("tags" as any)
            .insert(payload)
            .select();

          if (bulkData && !bulkError) {
            (bulkData as unknown as Tag[]).forEach((tag) => {
              successfulNewTags.push(tag);
              existingTagsMap.set(tag.name.toLowerCase().trim(), tag);
            });
            flowLog(
              "TAGS_BULK_CREATED",
              { count: chunk.length },
              "db_write",
              "tags",
            );
          } else {
            for (const tagName of chunk) {
              const { data, error } = await supabase
                .from("tags" as any)
                .insert({
                  store_id: storeId || null,
                  owner_id: user?.id,
                  name: tagName,
                  is_hard_constraint: false,
                })
                .select()
                .single();

              if (data) {
                successfulNewTags.push(data as unknown as Tag);
                existingTagsMap.set(
                  tagName.toLowerCase().trim(),
                  data as unknown as Tag,
                );
              } else if (error) {
                const { data: recoveredTag } = await supabase
                  .from("tags" as any)
                  .select("*")
                  .ilike("name", tagName)
                  .eq("owner_id", user?.id)
                  .maybeSingle();
                if (recoveredTag)
                  existingTagsMap.set(
                    tagName.toLowerCase().trim(),
                    recoveredTag as unknown as Tag,
                  );
              }
            }
          }
        }

        if (successfulNewTags.length > 0) {
          setTags((prev) => [...prev, ...successfulNewTags]);
          setTagCount((c) => c + successfulNewTags.length);
        }
      }

      const insertItemByKey = new Map<string, any>();
      toInsert.forEach((item) => {
        const key = `${String(item.dbRow.name).toLowerCase().trim()}::${String(
          item.dbRow.sku || "",
        )
          .toLowerCase()
          .trim()}`;
        insertItemByKey.set(key, item);
      });

      newProducts.forEach((product) => {
        const key = `${String(product.name).toLowerCase().trim()}::${String(
          product.sku || "",
        )
          .toLowerCase()
          .trim()}`;
        const item = insertItemByKey.get(key);
        if (!item) return;

        const tagsArray = item.tags || [];
        (Array.from(new Set(tagsArray)) as string[]).forEach(
          (tagStr: string) => {
            const tagObj = existingTagsMap.get(tagStr.toLowerCase().trim());
            if (tagObj && tagObj.id) {
              productTagsToInsert.push({
                product_id: product.id,
                tag_id: tagObj.id,
              });
            }
          },
        );
      });

      if (productTagsToInsert.length > 0) {
        for (
          let i = 0;
          i < productTagsToInsert.length;
          i += IMPORT_BATCH_SIZE
        ) {
          const chunk = productTagsToInsert.slice(i, i + IMPORT_BATCH_SIZE);
          await supabase.from("product_tags" as any).upsert(chunk, {
            onConflict: "product_id, tag_id",
            ignoreDuplicates: true,
          });
        }
        flowLog(
          "PRODUCT_TAGS_LINKED",
          { count: productTagsToInsert.length },
          "db_write",
          "product_tags",
        );
      }
      if (newProducts.length > 0 && user?.id) {
        triggerBatchEmbedding(user.id).catch((err) =>
          console.warn(
            "[importProductsFromFile] embedding trigger failed silently:",
            err,
          ),
        );
      }
      setProductCount((c) => c + newProducts.length);

      flowLog(
        "IMPORT_COMPLETE",
        { imported: newProducts.length, skipped },
        "info",
      );
      return { imported: newProducts.length, skipped, error: null };
    } catch (err: any) {
      flowLog(
        "IMPORT_FATAL_ERROR",
        { error: err.message, stack: err.stack },
        "error",
      );
      return {
        imported: 0,
        skipped: 0,
        error: err.message || "Failed to import products.",
      };
    }
  };

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    stores,
    zones,
    products,
    tags,
    integrations,
    isLoading,
    isProductsLoading,
    error,
    productCount,
    tagCount,
    fetchStores,
    createStore,
    updateStore,
    deleteStore,
    fetchZones,
    createZone,
    updateZone,
    deleteZone,
    fetchProducts,
    fetchProductCount,
    createProduct,
    updateProduct,
    deleteProduct,
    deleteAllProductsByOwner,
    refreshProduct,
    linkProductToStore,
    unlinkProductFromStore,
    fetchTags,
    connectNango,
    fetchTagCount,
    createTag,
    updateTag,
    deleteTag,
    bulkDeleteTags,
    deleteAllTagsByOwner,
    clearAllOrphanTags,
    linkTagToProduct,
    unlinkTagFromProduct,
    linkTagToZone,
    unlinkTagFromZone,
    fetchIntegrations,
    saveIntegration,
    saveWebhookUrl,
    importSquarespaceProducts,
    importProductsFromFile,
  };
}

// ─── Embedding Helpers ────────────────────────────────────────────────────

// Retry config
const EMBED_MAX_RETRIES = 3;
const EMBED_RETRY_DELAYS = [2000, 5000, 10000]; // ms — exponential backoff

async function triggerEmbedding(productId: string): Promise<void> {
  for (let attempt = 0; attempt < EMBED_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/embeddings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });

      if (res.ok) return;

      const body = await res.json().catch(() => ({}));
      const status = res.status;

      if (status === 400 || status === 404) {
        console.warn(
          `[triggerEmbedding] non-retryable error ${status} for product ${productId}:`,
          body,
        );
        return;
      }

      console.warn(
        `[triggerEmbedding] attempt ${attempt + 1} failed (${status}) for ${productId}, retrying in ${EMBED_RETRY_DELAYS[attempt]}ms...`,
      );
    } catch (networkErr) {
      console.warn(
        `[triggerEmbedding] network error attempt ${attempt + 1} for ${productId}:`,
        networkErr,
      );
    }

    if (attempt < EMBED_MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, EMBED_RETRY_DELAYS[attempt]));
    }
  }

  console.warn(
    `[triggerEmbedding] all ${EMBED_MAX_RETRIES} attempts failed for product ${productId}. ` +
      `Product is saved. Run /api/embeddings/backfill to re-process.`,
  );
}

async function triggerBatchEmbedding(ownerId: string): Promise<void> {
  const res = await fetch("/api/embeddings/backfill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner_id: ownerId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Backfill failed: ${res.status}`);
  }
}
