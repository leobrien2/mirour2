"use client";

import { useState, useMemo } from "react";
import { useStores } from "@/hooks/useStores";
import { Product } from "@/types/mirour";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  Image as ImageIcon,
  Link2,
  CheckSquare,
  Square,
  MapPin,
  AlertTriangle,
  Loader2,
  Box,
  Tag,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IntegrationsModal } from "./IntegrationsModal";

/** Strip HTML tags and decode entities for clean display. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|div|h[1-6]|li|section|article|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ProductManagerProps {
  storeId?: string;
}

export function ProductManager({ storeId }: ProductManagerProps) {
  const {
    products,
    tags,
    zones,
    stores,
    isLoading,
    createProduct,
    updateProduct,
    deleteProduct,
    createTag,
    linkTagToProduct,
    unlinkTagFromProduct,
    linkProductToStore,
    unlinkProductFromStore,
    refreshProduct,
  } = useStores();

  const storeProducts = useMemo(() => {
    return storeId
      ? products.filter(
          (p) => p.store_ids?.includes(storeId) || p.store_id === storeId,
        )
      : products;
  }, [products, storeId]);

  const storeTags = useMemo(() => {
    const relevantTags = storeId
      ? tags.filter((t) => t.store_id === storeId)
      : tags;
    // Sort latest tags first (descending by created_at)
    return relevantTags.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [tags, storeId]);

  const storeZones = useMemo(() => {
    return storeId ? zones.filter((z) => z.store_id === storeId) : zones;
  }, [zones, storeId]);

  const isGlobalMode = !storeId;

  // ── Global Error State ───────────────────────────────────────────────────
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Filters & Search ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterZone, setFilterZone] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterStore, setFilterStore] = useState("all");

  const filteredProducts = useMemo(() => {
    return storeProducts.filter((product) => {
      // Search
      const matchesSearch =
        searchQuery === "" ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Zone filter
      const matchesZone =
        filterZone === "all" ||
        (filterZone === "none" && !product.zone_id) ||
        product.zone_id === filterZone;

      // Tag filter
      const matchesTag =
        filterTag === "all" ||
        (filterTag === "none" &&
          (!product.tags || product.tags.length === 0)) ||
        product.tags?.some((t) => t.id === filterTag);

      // Store filter (only relevant in global mode)
      const matchesStore =
        !isGlobalMode ||
        filterStore === "all" ||
        (filterStore === "none" &&
          (!product.store_ids || product.store_ids.length === 0)) ||
        product.store_ids?.includes(filterStore);

      return matchesSearch && matchesZone && matchesTag && matchesStore;
    });
  }, [
    storeProducts,
    searchQuery,
    filterZone,
    filterTag,
    filterStore,
    isGlobalMode,
  ]);
  // ── Pagination state ─────────────────────────────────────────────────────
  const ITEMS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE),
  );

  // Ensure we don't land on a non-existent page after deletions
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE,
    );
  }, [filteredProducts, currentPage, ITEMS_PER_PAGE]);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [isStaffPick, setIsStaffPick] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Bulk selection state ─────────────────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkZoneId, setBulkZoneId] = useState("");
  const [isBulkZoning, setIsBulkZoning] = useState(false);
  const [showBulkZonePicker, setShowBulkZonePicker] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Bulk tag state
  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [isBulkTagging, setIsBulkTagging] = useState(false);

  // Inline Tag Creation state
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  // ── Form handlers ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const productData = {
      name,
      description,
      sku,
      price: price ? parseFloat(price) : undefined,
      image_url: imageUrl || undefined,
      zone_id: selectedZoneId || undefined,
      is_staff_pick: isStaffPick,
      in_stock: true,
    };

    setGlobalError(null);
    if (editingProduct) {
      const { error: updError } = await updateProduct(
        editingProduct.id,
        productData,
      );
      if (updError) setGlobalError(updError);

      if (!updError) {
        // Update Tags
        const currentTagIds = (editingProduct.tags || []).map((t) => t.id);
        for (const tagId of selectedTagIds.filter(
          (id) => !currentTagIds.includes(id),
        )) {
          await linkTagToProduct(editingProduct.id, tagId);
        }
        for (const tagId of currentTagIds.filter(
          (id) => !selectedTagIds.includes(id),
        )) {
          await unlinkTagFromProduct(editingProduct.id, tagId);
        }

        // Update Stores (Global Mode)
        if (isGlobalMode) {
          const currentStoreIds = editingProduct.store_ids || [];
          for (const sId of selectedStoreIds.filter(
            (id) => !currentStoreIds.includes(id),
          )) {
            await linkProductToStore(editingProduct.id, sId);
          }
          for (const sId of currentStoreIds.filter(
            (id) => !selectedStoreIds.includes(id),
          )) {
            await unlinkProductFromStore(editingProduct.id, sId);
          }
        }

        await refreshProduct(editingProduct.id);
        setEditingProduct(null);
      }
    } else {
      const result = await createProduct(storeId || null, productData);
      if (result.error) setGlobalError(result.error);

      if (result.data) {
        if (selectedTagIds.length > 0) {
          for (const tagId of selectedTagIds) {
            await linkTagToProduct(result.data.id, tagId);
          }
        }
        if (isGlobalMode && selectedStoreIds.length > 0) {
          for (const sId of selectedStoreIds) {
            await linkProductToStore(result.data.id, sId);
          }
        }
      }
      if (!result.error) setIsCreating(false);
    }
    setIsSubmitting(false);
    if (!globalError) resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSku("");
    setPrice("");
    setImageUrl("");
    setSelectedZoneId("");
    setIsStaffPick(false);
    setSelectedTagIds([]);
    setSelectedStoreIds([]);
  };

  const handleCreateInlineTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setIsSubmittingTag(true);
    const result = await createTag(
      storeId || "",
      newTagName.trim(),
      newTagCategory.trim(),
      false,
    );
    if (result.data) {
      setSelectedTagIds((prev) => [...prev, result.data?.id as string]);
      setIsCreateTagOpen(false);
      setNewTagName("");
      setNewTagCategory("");
      setShowAllTags(true); // Automatically show all tags if they created a new one, to ensure it stays visible
    } else if (result.error) {
      setGlobalError(result.error);
    }
    setIsSubmittingTag(false);
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingProduct(null);
    resetForm();
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(stripHtml(product.description) || "");
    setSku(product.sku || "");
    setPrice(product.price?.toString() || "");
    setImageUrl(product.image_url || "");
    setSelectedZoneId(product.zone_id || "");
    setIsStaffPick(product.is_staff_pick || false);
    setSelectedTagIds((product.tags || []).map((t) => t.id));
    setSelectedStoreIds(product.store_ids || []);
  };

  const handleDelete = async (productId: string) => {
    if (confirm("Delete this product?")) {
      setGlobalError(null);
      const res = await deleteProduct(productId);
      if (res?.error) setGlobalError(res.error);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // ── Bulk selection handlers ───────────────────────────────────────────────
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.size === storeProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(storeProducts.map((p) => p.id)));
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedProductIds(new Set());
    setShowBulkZonePicker(false);
    setShowBulkTagPicker(false);
    setBulkTagIds([]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedProductIds.size} selected product(s)?`))
      return;
    setIsBulkDeleting(true);
    let failCount = 0;
    for (const id of Array.from(selectedProductIds)) {
      const res = await deleteProduct(id);
      if (res?.error) failCount++;
    }
    setIsBulkDeleting(false);
    exitSelectMode();
    if (failCount > 0) {
      setGlobalError(
        `${failCount} product(s) could not be deleted. Refresh and try again.`,
      );
    }
  };

  const handleDeleteAll = async () => {
    setIsBulkDeleting(true);
    setShowDeleteAllConfirm(false);
    let failCount = 0;
    for (const product of storeProducts) {
      const res = await deleteProduct(product.id);
      if (res?.error) failCount++;
    }
    setIsBulkDeleting(false);
    exitSelectMode();
    if (failCount > 0) {
      setGlobalError(
        `${failCount} product(s) could not be deleted from the database. Try refreshing the page.`,
      );
    }
  };

  const handleBulkZoneChange = async () => {
    if (!bulkZoneId && bulkZoneId !== "") return;
    setIsBulkZoning(true);
    for (const id of Array.from(selectedProductIds)) {
      await updateProduct(id, { zone_id: bulkZoneId || undefined });
    }
    setIsBulkZoning(false);
    setBulkZoneId("");
    setShowBulkZonePicker(false);
    exitSelectMode();
  };

  const handleBulkAddTags = async () => {
    if (bulkTagIds.length === 0) return;
    setIsBulkTagging(true);
    for (const productId of Array.from(selectedProductIds)) {
      const product = storeProducts.find((p) => p.id === productId);
      const existingTagIds = (product?.tags || []).map((t) => t.id);
      for (const tagId of bulkTagIds) {
        if (!existingTagIds.includes(tagId)) {
          await linkTagToProduct(productId, tagId);
        }
      }

      if (bulkTagIds.length > 0) {
        await refreshProduct(productId);
      }
    }
    setIsBulkTagging(false);
    setBulkTagIds([]);
    setShowBulkTagPicker(false);
    exitSelectMode();
  };

  const allSelected =
    storeProducts.length > 0 &&
    selectedProductIds.size === storeProducts.length;
  const someSelected = selectedProductIds.size > 0;
  const isFormOpen = isCreating || !!editingProduct;

  return (
    <div className="space-y-4">
      {/* ── Integrations Modal ─────────────────────────────────────────── */}
      {isIntegrationsOpen && (
        <IntegrationsModal
          storeId={storeId}
          onClose={() => setIsIntegrationsOpen(false)}
        />
      )}

      {/* ── Delete-All Confirm Modal ───────────────────────────────────── */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4 p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold">Delete All Products?</h3>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete all {storeProducts.length}{" "}
                  products in this store.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 font-medium"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Product Modal ───────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[70vh] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">
                  {editingProduct ? "Edit Product" : "Add Product"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* Name + SKU */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lavender Candle"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                </div>

                {/* Price */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>

                {/* Image URL — full width so it is easy to find */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>

                {/* Image preview — always visible */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Image Preview
                  </label>
                  <div className="rounded-lg overflow-hidden border border-border h-36 bg-muted/40 flex items-center justify-center relative">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="w-10 h-10 opacity-25" />
                        <span className="text-xs">
                          Enter an image URL to preview
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    placeholder="What makes this product special?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm min-h-[80px] resize-none"
                  />
                </div>

                {/* Zone Assignment */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Zone Assignment
                  </label>
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  >
                    <option value="">No Zone</option>
                    {storeZones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    For zone-first filtering when customer scans a zone QR
                  </p>
                </div>

                {/* Global Store Assignment */}
                {isGlobalMode && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground mb-1">
                      Stores Availability
                    </label>
                    {stores.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {stores.map((s) => {
                          const isSelected = selectedStoreIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() =>
                                setSelectedStoreIds((prev) =>
                                  prev.includes(s.id)
                                    ? prev.filter((id) => id !== s.id)
                                    : [...prev, s.id],
                                )
                              }
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                              }`}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No stores created yet.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 text-balance">
                      Choose which stores this product is available in. This
                      determines where the product appears to customers.
                    </p>
                  </div>
                )}

                {/* Staff Pick Toggle */}
                <button
                  type="button"
                  onClick={() => setIsStaffPick(!isStaffPick)}
                  className="flex items-center gap-3 w-full text-left"
                >
                  <div
                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${isStaffPick ? "bg-yellow-500" : "bg-muted border border-border"}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${isStaffPick ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </div>
                  <div>
                    <span className="text-sm font-medium">Staff Pick</span>
                    <p className="text-xs text-muted-foreground">
                      Shown as fallback when no tag matches
                    </p>
                  </div>
                </button>

                {/* Tags */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Product Tags
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreateTagOpen(true)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Create Tag
                    </button>
                  </div>
                  {storeTags.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {storeTags
                          .slice(0, showAllTags ? storeTags.length : 20)
                          .map((tag) => {
                            const isSelected = selectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                  isSelected
                                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border-2 border-primary-500"
                                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                                }`}
                              >
                                {tag.name}
                                {isSelected && (
                                  <X className="inline-block w-3 h-3 ml-1" />
                                )}
                              </button>
                            );
                          })}

                        {!showAllTags && storeTags.length > 20 && (
                          <button
                            type="button"
                            onClick={() => setShowAllTags(true)}
                            className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1 border border-transparent"
                          >
                            <Plus className="w-3 h-3" />
                            Show {storeTags.length - 20} more tags
                          </button>
                        )}
                        {showAllTags && storeTags.length > 20 && (
                          <button
                            type="button"
                            onClick={() => setShowAllTags(false)}
                            className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1 border border-border"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      No tags for this store yet. Go to the{" "}
                      <span className="font-medium text-foreground">Tags</span>{" "}
                      tab to create some first.
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2 justify-end px-6 py-4 border-t border-border flex-shrink-0 bg-muted/20">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60 font-medium"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inline Tag Creation Modal ────────────────────────────────────── */}
      {isCreateTagOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4 flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold">Create Tag</h3>
              <button
                type="button"
                onClick={() => setIsCreateTagOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateInlineTag} className="flex flex-col">
              <div className="px-6 py-4 space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tag Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Spicy, Vegan, Large"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Category (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Dietary, Size"
                    value={newTagCategory}
                    onChange={(e) => setNewTagCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end px-6 py-4 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setIsCreateTagOpen(false)}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTag || !newTagName.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60 font-medium"
                >
                  {isSubmittingTag && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-lg font-semibold">
          Products ({filteredProducts.length})
        </h3>

        {globalError && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg text-sm font-medium mr-auto ml-4">
            <AlertTriangle className="w-4 h-4" />
            {globalError}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Select mode toggle */}
          {storeProducts.length > 0 && (
            <button
              onClick={() =>
                isSelectMode ? exitSelectMode() : setIsSelectMode(true)
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                isSelectMode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {isSelectMode ? "Cancel Select" : "Select"}
            </button>
          )}

          {/* Delete All */}
          {storeProducts.length > 0 && !isSelectMode && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-destructive/10 hover:text-destructive border border-border transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          )}

          <button
            onClick={() => setIsIntegrationsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 hover:text-foreground transition-colors text-sm border border-border"
          >
            <Link2 className="w-4 h-4" />
            Integrations
          </button>

          <button
            onClick={() => {
              setIsCreating(true);
              exitSelectMode();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* ── Filters Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 bg-muted/30 p-3 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products by name, SKU, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2 md:mt-0">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[140px]"
            >
              <option value="all">All Zones</option>
              <option value="none">No Zone</option>
              {storeZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[140px]"
            >
              <option value="all">All Tags</option>
              <option value="none">No Tags</option>
              {storeTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {filterTag !== "all" && filterTag !== "none" && (
              <button
                onClick={() => setFilterTag("all")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Store filter — only in Global Inventory mode */}
          {isGlobalMode && (
            <div className="relative">
              <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                className="pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[150px]"
              >
                <option value="all">All Stores</option>
                <option value="none">No Store</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {filterStore !== "all" && filterStore !== "none" && (
                <button
                  onClick={() => setFilterStore("all")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Action Bar (shown when in select mode) ────────────────── */}
      {isSelectMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border border-border rounded-xl flex-wrap">
          {/* Select All checkbox */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
            {allSelected ? "Deselect All" : "Select All"}
          </button>

          <span className="text-muted-foreground text-xs">
            {selectedProductIds.size} selected
          </span>

          {/* Bulk actions */}
          {someSelected && (
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {showBulkZonePicker ? (
                <>
                  <select
                    value={bulkZoneId}
                    onChange={(e) => setBulkZoneId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                  >
                    <option value="">No Zone</option>
                    {storeZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkZoneChange}
                    disabled={isBulkZoning}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60"
                  >
                    {isBulkZoning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                    Apply Zone
                  </button>
                  <button
                    onClick={() => setShowBulkZonePicker(false)}
                    className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                </>
              ) : showBulkTagPicker ? (
                <>
                  {storeTags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No tags available for this store.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                      {storeTags.map((tag) => {
                        const sel = bulkTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              setBulkTagIds((prev) =>
                                sel
                                  ? prev.filter((id) => id !== tag.id)
                                  : [...prev, tag.id],
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              sel
                                ? tag.is_hard_constraint
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-2 border-red-500"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-2 border-blue-500"
                                : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                            }`}
                          >
                            {tag.name}
                            {sel && <X className="inline-block w-3 h-3 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={handleBulkAddTags}
                    disabled={isBulkTagging || bulkTagIds.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60"
                  >
                    {isBulkTagging ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Tag className="w-3.5 h-3.5" />
                    )}
                    Add Tags
                    {bulkTagIds.length > 0 ? ` (${bulkTagIds.length})` : ""}
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkTagPicker(false);
                      setBulkTagIds([]);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowBulkZonePicker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 border border-border"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Change Zone
                  </button>
                  {storeTags.length > 0 && (
                    <button
                      onClick={() => setShowBulkTagPicker(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 border border-border"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Add Tags
                    </button>
                  )}
                  <button
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 disabled:opacity-60"
                  >
                    {isBulkDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete ({selectedProductIds.size})
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Product Grid ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground w-full col-span-full">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
          <p>Loading products...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedProducts.map((product) => {
            const productTags = product.tags || [];
            const productZone = storeZones.find(
              (z) => z.id === product.zone_id,
            );
            const isSelected = selectedProductIds.has(product.id);

            return (
              <div
                key={product.id}
                onClick={() => isSelectMode && toggleSelectProduct(product.id)}
                className={`bg-card rounded-xl border overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col h-[380px] ${
                  isSelectMode ? "cursor-pointer" : ""
                } ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              >
                {/* Product Image */}
                <div className="relative w-full h-48 bg-accent/10 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-accent">
                      <ImageIcon className="w-16 h-16 opacity-30" />
                    </div>
                  )}

                  {/* Staff Pick Badge */}
                  {product.is_staff_pick && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1.5 shadow-lg">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {isSelectMode && (
                    <div className="absolute top-2 left-2">
                      <div
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shadow-md transition-colors ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "bg-background/90 border-border"
                        }`}
                      >
                        {isSelected && (
                          <X className="w-3.5 h-3.5 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons (only when NOT in select mode) */}
                  {!isSelectMode && (
                    <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(product)}
                        className="p-2 bg-background/90 hover:bg-background rounded-lg text-foreground shadow-md"
                        title="Edit Product"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 bg-background/90 hover:bg-destructive/90 rounded-lg text-foreground hover:text-destructive-foreground shadow-md"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 p-4 flex flex-col overflow-hidden">
                  <h4
                    className="font-semibold text-base mb-2 truncate"
                    title={product.name}
                  >
                    {product.name}
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-1 mb-2">
                    <div className="flex w-full justify-between">
                      {product.price && (
                        <div className="font-medium text-foreground">
                          ${product.price.toFixed(2)}
                        </div>
                      )}
                      {product.sku && (
                        <div
                          className="text-xs truncate"
                          title={`SKU: ${product.sku}`}
                        >
                          SKU: {product.sku}
                        </div>
                      )}
                    </div>

                    {/* Store links in global mode */}
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        <p>Store:</p>
                        {isGlobalMode && (
                          <div className="flex flex-wrap gap-1">
                            {(product.store_ids || []).map((sid) => {
                              const st = stores.find((s) => s.id === sid);
                              return st ? (
                                <Badge
                                  key={sid}
                                  variant="secondary"
                                  className="text-xs px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                                >
                                  {st.name}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <p>Zone:</p>
                        {productZone && (
                          <Badge
                            variant="outline"
                            className=" truncate max-w-full"
                          >
                            {productZone.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {product.description && (
                      // two line max
                      <div
                        className="text-xs line-clamp-2"
                        title={stripHtml(product.description)}
                      >
                        {stripHtml(product.description)}
                      </div>
                    )}
                  </div>

                  {/* Tag chips */}
                  {productTags.length > 0 && (
                    <div className="relative group/tags">
                      <div className="flex flex-wrap gap-1">
                        {productTags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant={ "secondary"
                            }
                            className="text-xs px-2 py-0.5 truncate"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {productTags.length > 2 && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5"
                          >
                            +{productTags.length - 2}
                          </Badge>
                        )}
                      </div>
                      {productTags.length > 2 && (
                        <div className="absolute bottom-full left-0 mb-2 p-2 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border opacity-0 invisible group-hover/tags:opacity-100 group-hover/tags:visible transition-all duration-200 z-10 min-w-[200px] max-w-[280px]">
                          <div className="text-xs font-medium mb-1">
                            All Tags:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {productTags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant={"secondary"}
                                className="text-xs px-2 py-0.5"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {storeProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm border-2 border-dashed border-muted rounded-xl">
              No products yet. Add products or import from Integrations.
            </div>
          )}
        </div>
      )}

      {/* ── Pagination Controls ────────────────────────────────────────── */}
      {!isLoading && storeProducts.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border mt-4">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * ITEMS_PER_PAGE, storeProducts.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {storeProducts.length}
            </span>{" "}
            products
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
