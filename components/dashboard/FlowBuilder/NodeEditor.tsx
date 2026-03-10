"use client";

import { FlowNode } from "@/types/mirour";
import {
  ArrowLeft,
  Trash2,
  Plus,
  X,
  Upload,
  Check,
  ExternalLink,
  Tag as TagIcon,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useRef, useState, useEffect, useMemo } from "react";
import { uploadSectionImage } from "@/lib/storage";
import { SectionsEditor } from "./SectionsEditor";
import { useStores } from "@/hooks/useStores";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ContentCardEditorProps = {
  node: FlowNode;
  onUpdate: (updates: Partial<FlowNode>) => void;
};

function ContentCardEditor({ node, onUpdate }: ContentCardEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ imageUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    onUpdate({ imageUrl: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Image Upload */}
      <div>
        <label className="block text-foreground mb-2">Image (optional)</label>
        {node.imageUrl ? (
          <div className="relative">
            <img
              src={node.imageUrl}
              alt="Content card"
              className="w-full h-32 object-cover rounded-xl"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-24 border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm">Upload image</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Header */}
      <div>
        <label className="block text-foreground mb-2">Header</label>
        <input
          type="text"
          value={node.header || ""}
          onChange={(e) => onUpdate({ header: e.target.value })}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="e.g., Check this out!"
        />
      </div>

      {/* Subheader */}
      <div>
        <label className="block text-foreground mb-2">
          Subheader (optional)
        </label>
        <textarea
          value={node.subheader || ""}
          onChange={(e) => onUpdate({ subheader: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card resize-none"
          placeholder="Additional details or description..."
        />
      </div>

      {/* External Link */}
      <div className="bg-secondary rounded-2xl p-4 border-2 border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
            <label className="text-foreground">Add Link</label>
          </div>
          <Switch
            checked={!!node.linkUrl}
            onCheckedChange={(value) => {
              if (!value) {
                onUpdate({ linkUrl: undefined, linkTitle: undefined });
              } else {
                onUpdate({ linkUrl: "", linkTitle: "Learn More" });
              }
            }}
          />
        </div>
        {node.linkUrl !== undefined && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Button Text
              </label>
              <input
                type="text"
                value={node.linkTitle || ""}
                onChange={(e) => onUpdate({ linkTitle: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
                placeholder="e.g., Learn More"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                URL
              </label>
              <input
                type="url"
                value={node.linkUrl || ""}
                onChange={(e) => onUpdate({ linkUrl: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
                placeholder="https://example.com"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Welcome Card Editor with image upload
function WelcomeCardEditor({
  node,
  onUpdate,
  allNodes,
  formId,
}: {
  node: FlowNode;
  onUpdate: (updates: Partial<FlowNode>) => void;
  allNodes: FlowNode[];
  formId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      if (formId) {
        const publicUrl = await uploadSectionImage(
          file,
          formId,
          "welcome-logo",
        );
        if (publicUrl) {
          onUpdate({ imageUrl: publicUrl });
          setUploading(false);
          return;
        }
      }
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ imageUrl: event.target?.result as string });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ imageUrl: event.target?.result as string });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    onUpdate({ imageUrl: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Image Upload - 1:1 square */}
      <div>
        <label className="block text-foreground mb-2">
          Logo / Image (optional)
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Overrides your business logo for this form
        </p>
        {node.imageUrl ? (
          <div className="relative w-32 h-32 mx-auto">
            <div className="w-full h-full rounded-2xl overflow-hidden bg-secondary border-2 border-primary/20">
              <img
                src={node.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={handleRemoveImage}
              disabled={uploading}
              className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-32 h-32 mx-auto border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="text-sm">Uploading...</span>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span className="text-xs">1:1 Image</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Header */}
      <div>
        <label className="block text-foreground mb-2">Header</label>
        <input
          type="text"
          value={node.header || ""}
          onChange={(e) => onUpdate({ header: e.target.value })}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="Welcome!"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-foreground mb-2">Description</label>
        <textarea
          value={node.content || ""}
          onChange={(e) => onUpdate({ content: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card resize-none"
          placeholder="We'd love your feedback..."
        />
      </div>

      {/* Button Text */}
      <div>
        <label className="block text-foreground mb-2">Button Text</label>
        <input
          type="text"
          value={node.buttonText ?? "Get Started"}
          onChange={(e) => onUpdate({ buttonText: e.target.value })}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="Leave empty to hide button"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Clear to hide the button
        </p>
      </div>

      {/* Sections Editor */}
      <div className="border-t border-primary/10 pt-4 mt-4">
        <SectionsEditor
          sections={node.sections || []}
          allNodes={allNodes}
          onChange={(sections) => onUpdate({ sections })}
          formId={formId}
        />
      </div>
    </div>
  );
}

// Recommendation Node Editor
function RecommendationEditor({
  node,
  onUpdate,
  storeId,
}: ContentCardEditorProps & { storeId?: string }) {
  const { zones } = useStores();
  const storeZones = storeId ? zones.filter((z) => z.store_id === storeId) : [];

  return (
    <div className="space-y-4">
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl mb-4">
        <h4 className="font-medium flex items-center gap-2 text-primary">
          <TagIcon className="w-4 h-4" />
          Dynamic Recommendations
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          Products will be dynamically recommended based on tags accumulated
          from user answers.
        </p>
      </div>

      {/* Header */}
      <div>
        <label className="block text-foreground mb-2">Header</label>
        <input
          type="text"
          value={node.header || ""}
          onChange={(e) => onUpdate({ header: e.target.value })}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="e.g. Recommended for You"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-foreground mb-2">
          Description / Intro
        </label>
        <textarea
          value={node.content || ""}
          onChange={(e) => onUpdate({ content: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card resize-none"
          placeholder="Based on your needs, we recommend..."
        />
      </div>

      {/* Logic Config */}
      <div className="bg-secondary p-4 rounded-xl border-2 border-primary/20 space-y-4">
        <h4 className="font-medium text-foreground">Recommendation Logic</h4>

        {/* Result Limit */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Result Limit
          </label>
          <input
            type="number"
            min="1"
            max="10"
            placeholder="6"
            value={node.recommendationLogic?.limit || 6}
            onChange={(e) =>
              onUpdate({
                recommendationLogic: {
                  useTags: true,
                  matchStrategy:
                    node.recommendationLogic?.matchStrategy || "any",
                  ...node.recommendationLogic,
                  limit: parseInt(e.target.value) || 6,
                },
              })
            }
            className="w-full px-3 py-2 rounded-lg border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Number of products to show (1-10)
          </p>
        </div>

        {/* Zone Filter */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Filter by Zone (Optional)
          </label>
          <select
            value={node.recommendationLogic?.zoneId || ""}
            onChange={(e) =>
              onUpdate({
                recommendationLogic: {
                  useTags: true,
                  matchStrategy:
                    node.recommendationLogic?.matchStrategy || "any",
                  ...node.recommendationLogic,
                  zoneId: e.target.value || undefined,
                },
              })
            }
            className="w-full px-3 py-2 rounded-lg border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          >
            <option value="">All zones</option>
            {storeZones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            For zone flows: prioritize products from this zone
          </p>
        </div>

        {/* Match Strategy */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Match Strategy
          </label>
          <select
            value={node.recommendationLogic?.matchStrategy || "any"}
            onChange={(e) =>
              onUpdate({
                recommendationLogic: {
                  useTags: true,
                  ...node.recommendationLogic,
                  matchStrategy: e.target.value as "any" | "all" | "zone-first",
                },
              })
            }
            className="w-full px-3 py-2 rounded-lg border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          >
            <option value="any">Match Any Tag (OR logic)</option>
            <option value="all">Match All Tags (AND logic)</option>
            <option value="zone-first">
              Zone-First (prioritize zone products)
            </option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {node.recommendationLogic?.matchStrategy === "zone-first"
              ? "Filter by zone first, then match tags within zone products"
              : node.recommendationLogic?.matchStrategy === "all"
                ? "Products must have ALL collected tags"
                : "Products with at least ONE matching tag"}
          </p>
        </div>

        {/* Staff Picks Fallback */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-primary/10">
          <div>
            <div className="text-sm font-medium text-foreground">
              Fallback to Staff Picks
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Show staff picks if no products match tags
            </p>
          </div>
          <Switch
            checked={node.recommendationLogic?.fallbackToStaffPicks ?? true}
            onCheckedChange={(checked) =>
              onUpdate({
                recommendationLogic: {
                  useTags: true,
                  matchStrategy:
                    node.recommendationLogic?.matchStrategy || "any",
                  ...node.recommendationLogic,
                  fallbackToStaffPicks: checked,
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

// Add this helper outside the component
function rewireNextNodeIds(orderedNodes: FlowNode[]): FlowNode[] {
  return orderedNodes.map((node, index) => {
    const nextNode = orderedNodes[index + 1];

    // Last node (complete) — nothing to point to
    if (!nextNode) return node;

    const oldNextId = node.nextNodeId;
    const newNextId = nextNode.id;

    // Already correct, skip
    if (oldNextId === newNextId) return node;

    const updates: Partial<FlowNode> = { nextNodeId: newNextId };

    // Also re-wire conditionalNext entries that pointed to the old next node
    // (handles question nodes where all branches go to the same target)
    if (node.conditionalNext?.length && oldNextId) {
      const updatedConditional = node.conditionalNext.map((c) =>
        c.nextNodeId === oldNextId ? { ...c, nextNodeId: newNextId } : c,
      );
      updates.conditionalNext = updatedConditional;
    }

    return { ...node, ...updates };
  });
}

// ─── ProductShowcaseEditor ────────────────────────────────────────────────────
function ProductShowcaseEditor({
  node,
  onUpdate,
  storeId,
}: {
  node: FlowNode;
  onUpdate: (updates: Partial<FlowNode>) => void;
  storeId?: string;
}) {
  const { products } = useStores();
  const [search, setSearch] = useState("");

  // Filter products to current store
  const storeProducts = useMemo(
    () =>
      storeId
        ? products.filter(
            (p) => p.store_ids?.includes(storeId) || p.store_id === storeId,
          )
        : products,
    [products, storeId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return storeProducts.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    );
  }, [storeProducts, search]);

  const selected = new Set(node.pinnedProductIds ?? []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onUpdate({ pinnedProductIds: Array.from(next) });
  };

  const selectAll = () =>
    onUpdate({ pinnedProductIds: filtered.map((p) => p.id) });

  const deselectAll = () => onUpdate({ pinnedProductIds: [] });

  const selectFiltered = () => {
    const merged = Array.from(new Set([...selected, ...filtered.map((p) => p.id)]));
    onUpdate({ pinnedProductIds: merged });
  };

  const removeSelected = (id: string) =>
    onUpdate({ pinnedProductIds: (node.pinnedProductIds ?? []).filter((x) => x !== id) });

  // Reorder selected products via move up/down
  const move = (id: string, dir: -1 | 1) => {
    const arr = [...(node.pinnedProductIds ?? [])];
    const i = arr.indexOf(id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onUpdate({ pinnedProductIds: arr });
  };

  const selectedProducts = (node.pinnedProductIds ?? [])
    .map((id) => storeProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof storeProducts;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  return (
    <div className="space-y-5">
      {/* Header & Description */}
      <div>
        <label className="block text-foreground mb-2">Header (optional)</label>
        <input
          type="text"
          value={node.showcaseHeader || ""}
          onChange={(e) => onUpdate({ showcaseHeader: e.target.value })}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="e.g. Featured Products"
        />
      </div>

      <div>
        <label className="block text-foreground mb-2">Subheader (optional)</label>
        <textarea
          value={node.showcaseSubheader || ""}
          onChange={(e) => onUpdate({ showcaseSubheader: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card resize-none"
          placeholder="A short description shown above the products..."
        />
      </div>

      {/* Layout Toggle */}
      <div>
        <label className="block text-foreground mb-2">Layout</label>
        <div className="flex gap-2">
          {(["grid", "carousel"] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => onUpdate({ showcaseLayout: layout })}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-colors ${
                (node.showcaseLayout ?? "grid") === layout
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-primary/20 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {layout === "grid" ? "🔲 Grid" : "🎠 Carousel"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Picker ─────────────────────────────────────── */}
      <div className="border-t border-primary/10 pt-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-foreground font-medium">
            Select Products{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({selected.size} selected)
            </span>
          </label>

          <div className="flex gap-2">
            {search ? (
              <button
                type="button"
                onClick={selectFiltered}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
              >
                Select Filtered ({filtered.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={allFilteredSelected ? deselectAll : selectAll}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
              >
                {allFilteredSelected ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Product list */}
        {storeProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>No products in inventory.</p>
            <p className="text-xs mt-1">Add products to your store first.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">
            No products match "{search}"
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {filtered.map((product) => {
              const isSelected = selected.has(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggle(product.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-primary/10 hover:border-primary/30 bg-card"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        🛍️
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.price ? `$${product.price}` : "No price"}
                      {product.sku ? ` · ${product.sku}` : ""}
                    </p>
                  </div>

                  {/* Stock badge */}
                  {!product.in_stock && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex-shrink-0">
                      Out of stock
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Selected Products Order ────────────────────────────── */}
      {selectedProducts.length > 0 && (
        <div className="border-t border-primary/10 pt-4">
          <label className="block text-foreground font-medium mb-3">
            Display Order
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (drag order = customer view order)
            </span>
          </label>
          <div className="space-y-1.5">
            {selectedProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center gap-2 p-2 bg-secondary rounded-xl"
              >
                <span className="text-xs text-muted-foreground w-5 text-center flex-shrink-0">
                  {index + 1}
                </span>
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs">
                      🛍️
                    </div>
                  )}
                </div>
                <span className="flex-1 text-sm font-medium truncate">
                  {product.name}
                </span>
                {/* Move Up/Down */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(product.id, -1)}
                    disabled={index === 0}
                    className="p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(product.id, 1)}
                    disabled={index === selectedProducts.length - 1}
                    className="p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeSelected(product.id)}
                  className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type NodeEditorProps = {
  node: FlowNode;
  allNodes: FlowNode[];
  onUpdate: (updates: Partial<FlowNode>) => void;
  onDelete: () => void;
  onBack: () => void;
  onCreateStep?: () => void;
  onSave?: () => void;
  formId?: string;
  storeId?: string;
};

export function NodeEditor({
  node,
  allNodes,
  onUpdate,
  onDelete,
  onBack,
  onCreateStep,
  onSave,
  formId,
  storeId,
}: NodeEditorProps) {
  const canDelete = true; // All nodes can be deleted
  const hasOptions =
    node.questionType === "multiple-choice" ||
    node.questionType === "checkboxes" ||
    node.questionType === "quiz";

  // Use stores hook to get tags if storeId is present
  const { tags, fetchTags } = useStores();

  // Fetch tags on mount if storeId exists
  useEffect(() => {
    if (storeId) {
      fetchTags(storeId);
    }
  }, [storeId]); // fetchTags is stable? better add to dependency if not sure, or verify useStores implementation.
  // actually useStores returns new function instances usually.
  // Let's assume stability or just run once?
  // For safety, let's just depend on storeId.

  const storeTags = tags.filter((t) =>
    storeId ? t.store_id === storeId : false,
  );

  const handleAddOption = () => {
    const newOptions = [
      ...(node.options || []),
      `Option ${(node.options?.length || 0) + 1}`,
    ];
    const newScores =
      node.questionType === "quiz"
        ? [...(node.optionScores || []), 0]
        : node.optionScores;
    onUpdate({ options: newOptions, optionScores: newScores });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...(node.options || [])];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const handleUpdateScore = (index: number, score: number) => {
    const newScores = [
      ...(node.optionScores || node.options?.map(() => 0) || []),
    ];
    newScores[index] = score;
    onUpdate({ optionScores: newScores });
  };

  const handleRemoveOption = (index: number) => {
    if ((node.options?.length || 0) <= 2) return;
    const newOptions = (node.options || []).filter((_, i) => i !== index);
    const newScores =
      node.questionType === "quiz"
        ? (node.optionScores || []).filter((_, i) => i !== index)
        : node.optionScores;

    // Remove tags for this option
    const removedOptionValue = node.options?.[index];
    const newConditional = (node.conditionalNext || []).filter(
      (c) => c.optionValue !== removedOptionValue,
    );

    onUpdate({
      options: newOptions,
      optionScores: newScores,
      conditionalNext: newConditional,
    });
  };

  const handleToggleTagForOption = (optionIndex: number, tagId: string) => {
    const optionValue = node.options?.[optionIndex];
    // console.log("Toggling tag", tagId, "for option", optionValue);
    if (!optionValue) return;

    const existingConditional = node.conditionalNext || [];
    const currentEntry = existingConditional.find(
      (c) => c.optionValue === optionValue,
    );

    let nextNodeId = currentEntry?.nextNodeId ?? null;
    let currentTags = currentEntry?.addTags || [];

    if (currentTags.includes(tagId)) {
      currentTags = currentTags.filter((t) => t !== tagId);
    } else {
      currentTags = [...currentTags, tagId];
    }

    // Update logic matches handleSetConditionalNext logic structureish
    const newConditional = existingConditional.filter(
      (c) => c.optionValue !== optionValue,
    );

    // Only add back if there is nextNodeId OR tags
    if (nextNodeId || currentTags.length > 0) {
      newConditional.push({
        optionValue,
        nextNodeId: nextNodeId || undefined,
        addTags: currentTags,
      });
    }

    onUpdate({ conditionalNext: newConditional });
  };

  const getTagsForOption = (optionValue: string) => {
    return (
      node.conditionalNext?.find((c) => c.optionValue === optionValue)
        ?.addTags || []
    );
  };

  const handleSetJumpTo = (optionIndex: number, targetNodeId: string) => {
    const optionValue = node.options?.[optionIndex];
    if (!optionValue) return;

    const existingConditional = node.conditionalNext || [];
    // Remove existing entry for this option
    const otherEntries = existingConditional.filter(
      (c) => c.optionValue !== optionValue,
    );

    // Get current tags to preserve them
    const currentEntry = existingConditional.find(
      (c) => c.optionValue === optionValue,
    );
    const currentTags = currentEntry?.addTags || [];

    // If target is empty string (default), only keep if tags exist
    if (!targetNodeId && currentTags.length === 0) {
      onUpdate({ conditionalNext: otherEntries });
      return;
    }

    onUpdate({
      conditionalNext: [
        ...otherEntries,
        {
          optionValue,
          nextNodeId: targetNodeId || undefined,
          addTags: currentTags,
        },
      ],
    });
  };

  const getNodeLabel = (nodeId: string): string => {
    const target = allNodes.find((n) => n.id === nodeId);
    if (!target) return "Unknown";
    if (target.type === "question")
      return `Question: ${target.label || "Untitled"}`;
    if (target.type === "complete") return "End Screen";
    if (target.type === "customer-info") return "Customer Info";
    if (target.type === "recommendation")
      return `Rec: ${target.header || "Untitled"}`;
    return target.header || "Message";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this step?</AlertDialogTitle>
                <AlertDialogDescription>
                  {node.hasConditionalLogic &&
                  node.branches &&
                  node.branches.some((b) => b.nodes.length > 0)
                    ? "This will also delete all conditional branches and their steps. This action cannot be undone."
                    : "This action cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Welcome content */}
      {node.type === "welcome" && (
        <WelcomeCardEditor
          node={node}
          onUpdate={onUpdate}
          allNodes={allNodes}
          formId={formId}
        />
      )}

      {/* Content Card (Message) */}
      {node.type === "message" && (
        <ContentCardEditor node={node} onUpdate={onUpdate} />
      )}

      {/* Recommendation Node */}
      {node.type === "recommendation" && (
        <RecommendationEditor
          node={node}
          onUpdate={onUpdate}
          storeId={storeId}
        />
      )}

      {/* Customer Info */}
      {node.type === "customer-info" && (
        <div className="space-y-4">
          <div>
            <label className="block text-foreground mb-2">Message</label>
            <textarea
              value={node.content || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card resize-none"
              placeholder="Almost done! Share your info..."
            />
          </div>

          <div>
            <label className="block text-foreground mb-3">Capture Fields</label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                <span className="text-foreground">Name</span>
                <Switch
                  checked={node.captureFields?.name || false}
                  onCheckedChange={(value) =>
                    onUpdate({
                      captureFields: { ...node.captureFields, name: value },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                <span className="text-foreground">Email</span>
                <Switch
                  checked={node.captureFields?.email || false}
                  onCheckedChange={(value) =>
                    onUpdate({
                      captureFields: { ...node.captureFields, email: value },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                <span className="text-foreground">Phone</span>
                <Switch
                  checked={node.captureFields?.phone || false}
                  onCheckedChange={(value) =>
                    onUpdate({
                      captureFields: { ...node.captureFields, phone: value },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Required toggle */}
          <div className="flex items-center justify-between p-3 bg-secondary rounded-xl border-2 border-primary/20">
            <div>
              <span className="text-foreground font-medium">Required</span>
              <p className="text-xs text-muted-foreground">
                Users cannot skip this step
              </p>
            </div>
            <Switch
              checked={node.contactRequired || false}
              onCheckedChange={(value) => onUpdate({ contactRequired: value })}
            />
          </div>
        </div>
      )}

      {/* Complete Page */}
      {node.type === "complete" && (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-foreground mb-2">Title</label>
            <input
              type="text"
              value={node.header || ""}
              onChange={(e) => onUpdate({ header: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
              placeholder="Thank You!"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-foreground mb-2">Body</label>
            <textarea
              value={node.content || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card resize-none"
              placeholder="Thanks for helping shape what we do next."
            />
          </div>

          <div className="bg-secondary rounded-2xl p-4 border-2 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <label className="text-foreground">
                Offer a perk for completion
              </label>
              <Switch
                checked={node.hasPerk || false}
                onCheckedChange={(value) => onUpdate({ hasPerk: value })}
              />
            </div>
            {node.hasPerk && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Perk description
                  </label>
                  <input
                    type="text"
                    value={node.perk || ""}
                    onChange={(e) => onUpdate({ perk: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
                    placeholder="e.g., Free Coffee, 10% Off"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Redemption code (for your POS)
                  </label>
                  <input
                    type="text"
                    value={node.perkCode || ""}
                    onChange={(e) => onUpdate({ perkCode: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card font-mono"
                    placeholder="e.g., FREECOFFEE23"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Score-based result (for quiz routing) */}
          <div className="bg-secondary rounded-2xl p-4 border-2 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-foreground">Quiz Result Card</label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Show this card based on quiz score
                </p>
              </div>
              <Switch
                checked={node.isScoreResult || false}
                onCheckedChange={(value) =>
                  onUpdate({
                    isScoreResult: value,
                    scoreThreshold: value ? { min: 0, max: 10 } : undefined,
                  })
                }
              />
            </div>
            {node.isScoreResult && node.scoreThreshold && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-sm text-muted-foreground">
                  Show when score is
                </span>
                <input
                  type="number"
                  min="0"
                  value={node.scoreThreshold.min}
                  onChange={(e) =>
                    onUpdate({
                      scoreThreshold: {
                        ...node.scoreThreshold!,
                        min: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-16 px-2 py-2 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm text-center"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="number"
                  min="0"
                  value={node.scoreThreshold.max}
                  onChange={(e) =>
                    onUpdate({
                      scoreThreshold: {
                        ...node.scoreThreshold!,
                        max: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-16 px-2 py-2 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm text-center"
                />
              </div>
            )}
          </div>

          {/* Sections Editor for Complete */}
          <div className="border-t border-primary/10 pt-4 mt-4">
            <SectionsEditor
              sections={node.sections || []}
              allNodes={allNodes}
              onChange={(sections) => onUpdate({ sections })}
              formId={formId}
            />
          </div>
        </div>
      )}

      {/* Question */}
      {node.type === "question" && (
        <div className="space-y-4">
          <div>
            <label className="block text-foreground mb-2">Question</label>
            <input
              type="text"
              value={node.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
              placeholder="Enter your question..."
            />
          </div>

          <label className="flex items-center gap-3 text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={node.required || false}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
            />
            Required
          </label>

          {/* Options for multiple choice / checkboxes / quiz */}
          {hasOptions && (
            <div className="space-y-3">
              <label className="block text-foreground">
                {node.questionType === "quiz" ? "Options & Points" : "Options"}
              </label>
              {node.options?.map((option, index) => {
                const assignedTags = getTagsForOption(option);
                // Get current jump target if any
                const jumpTargetId =
                  node.conditionalNext?.find((c) => c.optionValue === option)
                    ?.nextNodeId || "";

                return (
                  <div
                    key={index}
                    className="flex flex-col gap-2 p-3 bg-secondary rounded-xl border border-primary/10"
                  >
                    <div className="flex items-center gap-2">
                      {/* Drag Handle Placeholder if needed later */}
                      <div className="w-1.5 h-8 bg-muted-foreground/20 rounded-full" />

                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          handleUpdateOption(index, e.target.value)
                        }
                        className="flex-1 px-4 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
                        placeholder={`Option ${index + 1}`}
                      />
                      {/* Point input for quiz questions */}
                      {node.questionType === "quiz" && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={node.optionScores?.[index] ?? 0}
                            onChange={(e) =>
                              handleUpdateScore(
                                index,
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="w-14 px-2 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm text-center"
                          />
                          <span className="text-xs text-muted-foreground">
                            pts
                          </span>
                        </div>
                      )}
                      {(node.options?.length || 0) > 2 && (
                        <button
                          onClick={() => handleRemoveOption(index)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Logic Row: Jump To & Tags */}
                    <div className="flex flex-wrap items-center gap-3 mt-1 pt-2 border-t border-primary/5">
                      {/* Jump To Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">
                          Jump to:
                        </span>
                        <select
                          value={jumpTargetId}
                          onChange={(e) =>
                            handleSetJumpTo(index, e.target.value)
                          }
                          className="text-xs bg-card border-border rounded-md px-2 py-1 max-w-[150px] truncate"
                        >
                          <option value="">Next Step (Default)</option>
                          {allNodes
                            .filter((n) => n.id !== node.id) // Prevent self-loop
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {getNodeLabel(n.id)}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Tags Selection per Option */}
                      {storeId && (
                        <div className="flex items-center gap-2 flex-wrap border-l border-primary/10 pl-3">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <TagIcon className="w-3 h-3" />
                            Tag:
                          </span>
                          {storeTags.length > 0 ? (
                            <>
                              {storeTags.map((tag) => {
                                const isSelected = assignedTags.includes(
                                  tag.id,
                                );

                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() =>
                                      handleToggleTagForOption(index, tag.id)
                                    }
                                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                      isSelected
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                    }`}
                                  >
                                    {tag.name}
                                  </button>
                                );
                              })}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              No tags.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={handleAddOption}
                className="flex items-center gap-2 text-sm text-primary hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add option
              </button>
            </div>
          )}

          {/* Rating scale labels */}
          {node.questionType === "rating" && (
            <div className="space-y-3">
              <label className="block text-foreground">Scale Labels</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Left (1)
                  </label>
                  <input
                    type="text"
                    value={node.ratingScaleLeft || ""}
                    onChange={(e) =>
                      onUpdate({ ratingScaleLeft: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
                    placeholder="e.g., Poor"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Right (5)
                  </label>
                  <input
                    type="text"
                    value={node.ratingScaleRight || ""}
                    onChange={(e) =>
                      onUpdate({ ratingScaleRight: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
                    placeholder="e.g., Excellent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional routing toggle for choice questions */}
          {hasOptions && node.options && node.options.length > 0 && (
            <div className="bg-secondary rounded-2xl p-4 border-2 border-primary/20">
              <div className="flex items-center justify-between">
                <label className="text-foreground">Conditional Logic</label>
                <Switch
                  checked={node.hasConditionalLogic || false}
                  onCheckedChange={(value) => {
                    onUpdate({
                      hasConditionalLogic: value,
                      // Initialize branches when toggling on
                      branches: value
                        ? node.options?.map((opt) => ({
                            optionValue: opt,
                            nodes: [],
                          }))
                        : [],
                      conditionalNext: value ? [] : [],
                    });
                  }}
                />
              </div>

              {node.hasConditionalLogic && (
                <div className="mt-4 p-3 bg-primary/5 rounded-xl">
                  <p className="text-sm text-muted-foreground">
                    Add steps to each branch on the canvas. Each answer option
                    has its own path that merges back to the main flow.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {node.type === "product-showcase" && (
        <ProductShowcaseEditor
          node={node}
          onUpdate={onUpdate}
          storeId={storeId}
        />
      )}
      {/* Save button - only shown when onSave is provided (edit mode) */}
      {onSave && (
        <button
          onClick={onSave}
          className="w-full mt-6 py-4 bg-foreground text-background font-medium rounded-2xl hover:bg-foreground/90 transition-colors"
        >
          Save Changes
        </button>
      )}
    </div>
  );
}
