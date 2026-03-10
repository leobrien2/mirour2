"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Responders } from "@/components/dashboard/Responders";
import { ResponderProfile } from "@/components/dashboard/ResponderProfile";
import { ResponsesView } from "@/components/dashboard/ResponsesView";
import { useForms } from "@/hooks/useForms";
import { useResponses } from "@/hooks/useResponses";
import { DashboardForm, toDashboardForm } from "@/types/dashboard";

type SubView =
  | { type: "list" }
  | { type: "profile"; userId: string }
  | { type: "responses"; formId: string; search: string };

export default function RespondersPage() {
  return (
    <ProtectedRoute>
      <RespondersContent />
    </ProtectedRoute>
  );
}

function RespondersContent() {
  const { forms } = useForms();
  const { fetchResponses, updateResponseCustomerInfo } = useResponses();
  const [dashboardForms, setDashboardForms] = useState<DashboardForm[]>([]);
  const [view, setView] = useState<SubView>({ type: "list" });

  // Use a stable key so we only re-fetch responses when form IDs actually change,
  // not every time the forms array gets a new reference.
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

  const handleSearchChange = useCallback((s: string) => {
    setView((prev) =>
      prev.type === "responses" ? { ...prev, search: s } : prev,
    );
  }, []);

  return (
    <DashboardLayout>
      {view.type === "profile" ? (
        <ResponderProfile
          userId={view.userId}
          forms={dashboardForms}
          onBack={() => setView({ type: "list" })}
          onNavigateToResponse={(formId, searchQuery) =>
            setView({ type: "responses", formId, search: searchQuery ?? "" })
          }
          onUpdateCustomerInfo={async (responseId, updates) => {
            const result = await updateResponseCustomerInfo(
              responseId,
              updates,
            );
            if (!result.error) {
              const enriched = await Promise.all(
                forms.map(async (form) => {
                  const responses = await fetchResponses(form.id);
                  return toDashboardForm(form, responses);
                }),
              );
              setDashboardForms(enriched);
            }
            return result;
          }}
        />
      ) : view.type === "responses" ? (
        <ResponsesView
          form={dashboardForms.find((f) => f.id === view.formId)!}
          onBack={() => setView({ type: "list" })}
          initialSearch={view.search}
          onSearchChange={handleSearchChange}
          onNavigateToUserProfile={(userId) =>
            setView({ type: "profile", userId })
          }
        />
      ) : (
        // Responders now fetches its own data directly from customers table
        <Responders
          onNavigateToUserProfile={(userId) =>
            setView({ type: "profile", userId })
          }
        />
      )}
    </DashboardLayout>
  );
}
