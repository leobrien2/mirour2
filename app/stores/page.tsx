"use client";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StoreManager } from "@/components/dashboard/StoreManager";
import { useForms } from "@/hooks/useForms";
import { useResponses } from "@/hooks/useResponses";
import { DashboardForm, toDashboardForm } from "@/types/dashboard";
import { useState, useEffect } from "react";

export default function StoresPage() {
  return (
    <ProtectedRoute>
      <StoresContent />
    </ProtectedRoute>
  );
}

function StoresContent() {
  const { forms } = useForms();
  const { fetchResponses } = useResponses();
  const [dashboardForms, setDashboardForms] = useState<DashboardForm[]>([]);

  const formsKey = forms.map((f) => f.id).join(",");
  useEffect(() => {
    const load = async () => {
      const enriched = await Promise.all(
        forms.map(async (form) => {
          const responses = await fetchResponses(form.id);
          return toDashboardForm(form, responses);
        }),
      );
      setDashboardForms(enriched);
    };
    if (forms.length > 0) load();
    else setDashboardForms([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formsKey]);

  return (
    <DashboardLayout>
      <StoreManager forms={dashboardForms} />
    </DashboardLayout>
  );
}
