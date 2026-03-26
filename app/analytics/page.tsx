"use client";

import { Analytics } from "@/components/dashboard/Analytics";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useForms } from "@/hooks/useForms";
import { useResponses } from "@/hooks/useResponses";
import { useEffect, useState } from "react";
import { DashboardForm, toDashboardForm, RawDbResponse } from "@/types/dashboard";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const { forms, loading: formsLoading } = useForms();
  const { fetchResponses } = useResponses();
  const [dashboardForms, setDashboardForms] = useState<DashboardForm[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      if (forms.length > 0) {
        setLoading(true);
        const enriched = await Promise.all(
          forms.map(async (form) => {
            const responses = await fetchResponses(form.id);
            return toDashboardForm(form, responses as unknown as RawDbResponse[]);
          }),
        );
        setDashboardForms(enriched);
        setLoading(false);
      } else if (!formsLoading) {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleNavigateToResponses = (formId: string, searchQuery: string) => {
    router.push(`/myflows?view=responses&formId=${formId}&search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading || formsLoading ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Analytics 
            forms={dashboardForms} 
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

