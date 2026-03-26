"use client";

import { useState } from "react";
import { X, Bookmark, Trash2, ShoppingBag, LogIn } from "lucide-react";
import type { SavedItem } from "@/types/mirour";

interface SavedItemsDrawerProps {
  open: boolean;
  onClose: () => void;
  savedItems: SavedItem[]; // was: EnrichedSavedItem[]
  onRemove: (productId: string) => Promise<void>;
  onLoginClick: () => void;
  customerId: string | null;
  allProducts?: any[];
}
export function SavedItemsDrawer({
  open,
  onClose,
  savedItems,
  onRemove,
  onLoginClick,
  customerId,
  allProducts = [],
}: SavedItemsDrawerProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await onRemove(productId);
    setRemovingId(null);
  };

  // Enrich: prefer DB-joined product, fallback to allProducts array
  const items = savedItems.map((item) => {
    const p =
      (item as any).products ??
      allProducts.find((ap) => ap.id === item.product_id);
    return { ...item, _p: p };
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto
          bg-background rounded-t-3xl shadow-2xl border-t border-border/50
          transition-transform duration-300 ease-out
          ${open ? "translate-y-0" : "translate-y-full pointer-events-none"}
        `}
        style={{ maxHeight: "82dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Saved Items
              {items.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({items.length})
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sign-in nudge for anonymous users with saves */}
        {!customerId && items.length > 0 && (
          <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/5 border border-primary/20">
            <LogIn className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-foreground/70 flex-1 leading-snug">
              Sign in to keep your wishlist across visits
            </p>
            <button
              onClick={onLoginClick}
              className="text-xs font-bold text-primary hover:underline shrink-0"
            >
              Sign in
            </button>
          </div>
        )}

        {/* Items list */}
        <div
          className="overflow-y-auto px-4 py-4 space-y-3"
          style={{ maxHeight: "calc(82dvh - 130px)" }}
        >
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-1">
                <ShoppingBag className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No saved items yet
              </p>
              <p className="text-xs text-muted-foreground/50 max-w-44">
                Tap the bookmark icon on any product to save it here
              </p>
            </div>
          ) : (
            items.map((item) => {
              const p = item._p;
              const isRemoving = removingId === item.product_id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card transition-all duration-200 ${
                    isRemoving ? "opacity-40 scale-[0.97]" : ""
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/30">
                    {p?.imageurl ? (
                      <img
                        src={p.imageurl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                      {p?.name ?? "Product"}
                    </p>
                    {p?.price != null && (
                      <p className="text-xs font-bold text-primary mt-0.5">
                        ${Number(p.price).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemove(item.product_id)}
                    disabled={isRemoving}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Remove saved item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
