"use client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProductManager } from "@/components/dashboard/StoreManager/ProductManager";
import { Button } from "@/components/ui/button";
import { Box, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
// import { useRouter } from "next/navigation";

export default function InventoryPage() {
  const router = useRouter();
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <h1 className="text-3xl font-heading flex items-center gap-3">
              <Box className="w-8 h-8 text-primary" />
              Global Inventory
            </h1>
            <Button onClick={() => router.push("/tags")}>
              <Tag className="w-4 h-4 mr-2" />
              Manage Tags
            </Button>
          </div>
          <p className="text-muted-foreground">
            Manage your entire catalog of products across all stores. Adding a
            product here makes it available to link to any of your active
            stores.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <ProductManager />
        </div>
      </div>
    </DashboardLayout>
  );
}
