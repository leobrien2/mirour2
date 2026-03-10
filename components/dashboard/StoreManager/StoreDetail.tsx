"use client";

import { useState } from "react";
import { useStores } from "@/hooks/useStores";
import { Store } from "@/types/mirour";
import { DashboardForm } from "@/types/dashboard";
import { ArrowLeft, MapPin, Package, Map, BarChart3 } from "lucide-react";
import { ZoneManager } from "./ZoneManager";
import { ProductManager } from "./ProductManager";
import { ZoneAnalytics } from "./ZoneAnalytics";
import TagManager from "./TagManager";

interface StoreDetailProps {
  store: Store;
  forms: DashboardForm[];
  onBack: () => void;
}

export function StoreDetail({ store, forms, onBack }: StoreDetailProps) {
  const { tags, createTag } = useStores();
  const storeTags = tags.filter((t) => t.store_id === store.id);

  const [activeTab, setActiveTab] = useState<
    "zones" | "products" | "analytics"
  >("zones");

  const handleCreateTag = async (
    name: string,
    category: string,
    isHardConstraint: boolean,
  ) => {
    await createTag(store.id, name, category || "", isHardConstraint);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold font-heading">{store.name}</h2>
            {store.location && (
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <MapPin className="w-3 h-3" />
                {store.location}
              </div>
            )}
          </div>
        </div>
        {/* Tag Manager Button */}
      
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("zones")}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "zones"
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Map className="w-4 h-4" />
          Zones
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "products"
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          Products
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "analytics"
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "zones" && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <ZoneManager storeId={store.id} forms={forms} />
          </div>
        )}
        {activeTab === "products" && <ProductManager storeId={store.id} />}
        {activeTab === "analytics" && (
          // Note: We need to pass zones to Analytics. ZoneManager fetches them internally.
          // Ideally we should lift state up, but for MVP we will fetch inside ZoneAnalytics
          // or render ZoneManager in a hidden way to get zones?
          // Actually ZoneAnalytics expects `zones` prop.
          // Let's refactor ZoneAnalytics to fetch zones if not provided, OR refactor StoreDetail to fetch zones.
          // Given the time, I'll modify ZoneAnalytics to fetch zones itself using storeId.
          <ZoneAnalytics storeId={store.id} zones={[]} />
        )}
      </div>
    </div>
  );
}
