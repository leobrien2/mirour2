"use client";

import { useState } from "react";
import { useStores } from "@/hooks/useStores";
import { Store } from "@/types/mirour";
import {
  Plus,
  MapPin,
  ChevronRight,
  Store as StoreIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { StoreForm } from "./StoreForm";
import { StoreDetail } from "./StoreDetail";
import { DashboardForm } from "@/types/dashboard";
import { trackEvent } from "@/lib/mixpanel";

interface StoreManagerProps {
  forms: DashboardForm[];
}

export function StoreManager({ forms }: StoreManagerProps) {
  const { stores, isLoading, createStore, updateStore, deleteStore } =
    useStores();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  if (selectedStore) {
    return (
      <StoreDetail
        store={selectedStore}
        forms={forms}
        onBack={() => setSelectedStore(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">
            Locations
          </h2>
          <p className="text-muted-foreground">
            Manage your physical locations and their zones.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {(isCreating || editingStore) && (
        <StoreForm
          initialData={editingStore || undefined}
          onSubmit={async (data) => {
            if (editingStore) {
              await updateStore(editingStore.id, data);
              trackEvent("Store Updated", {
                storeId: editingStore.id,
                storeName: data.name,
              });
            } else {
              await createStore(data.name, data.location);
              trackEvent("Store Created", { storeName: data.name });
            }
            setIsCreating(false);
            setEditingStore(null);
          }}
          onCancel={() => {
            setIsCreating(false);
            setEditingStore(null);
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <div
            key={store.id}
            className="group relative bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 cursor-pointer"
            onClick={() => setSelectedStore(store)}
          >
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingStore(store);
                }}
                className="p-2 hover:bg-muted rounded-full"
              >
                <Pencil className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this store?")) {
                    deleteStore(store.id);
                    trackEvent("Store Deleted", {
                      storeId: store.id,
                      storeName: store.name,
                    });
                  }
                }}
                className="p-2 hover:bg-destructive/10 rounded-full"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <StoreIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{store.name}</h3>
                {store.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {store.location}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center text-sm text-primary font-medium mt-4">
              Manage Zones & Products <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        ))}

        {stores.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No stores found. Create your first store to get started.
          </div>
        )}
      </div>
    </div>
  );
}
