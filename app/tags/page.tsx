"use client";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TagManagerView } from "@/components/dashboard/TagManagerView";

export default function TagsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TagManagerView />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
