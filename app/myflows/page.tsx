"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FormsList } from "@/components/dashboard/FormsList";
import { FlowBuilder } from "@/components/dashboard/FlowBuilder";
import { CreateFormSimple } from "@/components/dashboard/CreateFormSimple";
import { ResponsesView } from "@/components/dashboard/ResponsesView";
import { ResponderProfile } from "@/components/dashboard/ResponderProfile";
import { useForms } from "@/hooks/useForms";
import { useResponses } from "@/hooks/useResponses";
import { useAuth } from "@/hooks/useAuth";
import { useStores } from "@/hooks/useStores";
import { DashboardForm, toDashboardForm } from "@/types/dashboard";
import { supabase } from "@/integrations/supabase/client";

type SubView =
  | { type: "list" }
  | { type: "create" }
  | { type: "edit"; formId: string }
  | { type: "responses"; formId: string; search: string }
  | { type: "profile"; userId: string };

export default function MyFlowsPage() {
  return (
    <ProtectedRoute>
      <MyFlowsContent />
    </ProtectedRoute>
  );
}

function MyFlowsContent() {
  const { profile } = useAuth();
  const {
    forms,
    loading: formsLoading,
    fetchForms,
    createForm,
    updateForm,
    deleteForm,
    toggleFormActive,
  } = useForms();
  const { stores } = useStores();
  const { fetchResponses, updateResponseCustomerInfo } = useResponses();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [dashboardForms, setDashboardForms] = useState<DashboardForm[]>([]);
  const [view, setView] = useState<SubView>({ type: "list" });
  const [pendingEditFormId, setPendingEditFormId] = useState<string | null>(
    null,
  );
  const [isDirty, setIsDirty] = useState(false);

  // Browser-level warning for closing/refreshing tab
  useEffect(() => {
    // resetStore("772a3a12-6f07-4c66-bd6b-137dd6dc2d85");
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const confirmExit = useCallback(() => {
    if (isDirty) {
      return window.confirm("You made changes, exit without saving?");
    }
    return true;
  }, [isDirty]);

  const safeSetView = useCallback(
    (newView: SubView) => {
      if (confirmExit()) {
        setView(newView);
        setIsDirty(false);
      }
    },
    [confirmExit],
  );

  async function resetStore(storeId: string) {
    // Assuming you get the session token from Supabase client
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.error("Not authenticated");
      return;
    }
    try {
      const response = await fetch("/api/store/reset", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to reset store");
      }
      console.log("Success:", data.message);
      // Refresh your UI here
    } catch (error) {
      console.error("Error resetting store:", error);
    }
  }

  // If the URL has ?create=true (from the DashboardLayout menu), open create view
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setView({ type: "create" });
      // Clean the param from the URL without adding a history entry
      router.replace("/myflows");
    }
  }, []);

  // Use a stable key so we only re-fetch when the set of form IDs changes,
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

      if (
        pendingEditFormId &&
        enriched.some((f) => f.id === pendingEditFormId)
      ) {
        setView({ type: "edit", formId: pendingEditFormId });
        setPendingEditFormId(null);
      }
    };
    if (forms.length > 0) load();
    else setDashboardForms([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formsKey, pendingEditFormId]);

  const handleFormCreatedThenEdit = async (formId: string) => {
    await fetchForms();
    setPendingEditFormId(formId);
    setPendingEditFormId(formId);
    setView({ type: "list" });
    setIsDirty(false);
  };

  const handleFormUpdateSuccess = async () => {
    const enriched = await Promise.all(
      forms.map(async (form) => {
        const responses = await fetchResponses(form.id);
        return toDashboardForm(form, responses);
      }),
    );
    setDashboardForms(enriched);
    setView({ type: "list" });
    setIsDirty(false);
  };

  const handleSearchChange = useCallback((s: string) => {
    setView((prev) =>
      prev.type === "responses" ? { ...prev, search: s } : prev,
    );
  }, []);

  return (
    <DashboardLayout>
      {formsLoading ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view.type === "profile" ? (
        <ResponderProfile
          userId={view.userId}
          forms={dashboardForms}
          onBack={() => safeSetView({ type: "list" })}
          onNavigateToResponse={(formId, searchQuery) =>
            safeSetView({
              type: "responses",
              formId,
              search: searchQuery ?? "",
            })
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
          onBack={() => safeSetView({ type: "list" })}
          initialSearch={view.search}
          onSearchChange={handleSearchChange}
          onNavigateToUserProfile={(userId) =>
            setView({ type: "profile", userId })
          }
        />
      ) : view.type === "create" ? (
        <div className="max-w-md mx-auto w-full animate-fade-in">
          <div className="mb-4">
            <button
              onClick={() => safeSetView({ type: "list" })}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to flows</span>
            </button>
          </div>
          <CreateFormSimple
            stores={stores}
            onCreateForm={createForm}
            onSuccess={handleFormCreatedThenEdit}
            onCancel={() => safeSetView({ type: "list" })}
            onDirtyChange={setIsDirty}
          />
        </div>
      ) : view.type === "edit" ? (
        <div className="max-w-7xl mx-auto w-full animate-fade-in">
          <div className="mb-4">
            <button
              onClick={() => safeSetView({ type: "list" })}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to flows</span>
            </button>
          </div>
          <FlowBuilder
            existingForm={dashboardForms.find((f) => f.id === view.formId)}
            onUpdateForm={updateForm}
            onDeleteForm={deleteForm}
            onSuccess={handleFormUpdateSuccess}
            businessLogo={profile?.business_logo}
            onDirtyChange={setIsDirty}
          />
        </div>
      ) : (
        <FormsList
          forms={dashboardForms}
          onCreateForm={() => safeSetView({ type: "create" })}
          onViewResponses={(formId, search) =>
            safeSetView({ type: "responses", formId, search: search ?? "" })
          }
          onToggleFormActive={toggleFormActive}
          onDeleteForm={deleteForm}
          onEditForm={(formId) => safeSetView({ type: "edit", formId })}
          businessName={profile?.business_name}
          businessLogo={profile?.business_logo}
        />
      )}
    </DashboardLayout>
  );
}
