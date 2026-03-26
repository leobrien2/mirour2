"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FormsList } from "@/components/dashboard/FormsList";
import { CreateFormSimple } from "@/components/dashboard/CreateFormSimple";
import { ResponsesView } from "@/components/dashboard/ResponsesView";
import { ResponderProfile } from "@/components/dashboard/ResponderProfile";
import { useForms } from "@/hooks/useForms";
import { useResponses } from "@/hooks/useResponses";
import { useAuth } from "@/hooks/useAuth";
import { useStores } from "@/hooks/useStores";
import { DashboardForm, toDashboardForm, RawDbResponse } from "@/types/dashboard";
import type { CanvasFlow } from "@/types/canvas";
import { PageBuilder } from "@/components/dashboard/FlowBuilder/canvas/PageBuilder";

// ── View types ────────────────────────────────────────────────────────────────

type SubView =
  | { type: "list" }
  | { type: "create" }
  | { type: "edit"; formId: string; freshForm?: any }
  | { type: "responses"; formId: string; search: string }
  | { type: "profile"; userId: string };

// ── Adapter ───────────────────────────────────────────────────────────────────

function formToCanvasFlow(form: any): CanvasFlow {
  if (!form) {
    return {
      id: crypto.randomUUID(),
      name: "Untitled Flow",
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const questions = form.questions || [];
  const isCanvasFormat = questions.length > 0 && "blocks" in questions[0];
  return {
    id: form.id,
    name: form.name || "Untitled Flow",
    steps: isCanvasFormat
      ? questions
      : questions.map((node: any, i: number) => ({
          id: node.id,
          label: node.label || node.header || `Step ${i + 1}`,
          blocks: [],
          createdAt: new Date().toISOString(),
        })),
    createdAt: form.created_at ?? new Date().toISOString(),
    updatedAt: form.updated_at ?? new Date().toISOString(),
  };
}

// ── Entry ─────────────────────────────────────────────────────────────────────

export default function MyFlowsPage() {
  return (
    <ProtectedRoute>
      <MyFlowsContent />
    </ProtectedRoute>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────

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
    fetchForm,
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
  const [isFetchingForm, setIsFetchingForm] = useState(false);

  // ── Unload warning ──────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Dirty guard ─────────────────────────────────────────────────────────────

  const confirmExit = useCallback(() => {
    if (isDirty)
      return window.confirm("You have unsaved changes. Exit without saving?");
    return true;
  }, [isDirty]);

  const safeSetView = useCallback(
    (next: SubView) => {
      if (confirmExit()) {
        setView(next);
        setIsDirty(false);
      }
    },
    [confirmExit],
  );

  // ── ?create=true URL param ──────────────────────────────────────────────────

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setView({ type: "create" });
      router.replace("/myflows");
    }
  }, []);

  // ── Load + enrich forms ─────────────────────────────────────────────────────

  const formsKey = forms.map((f) => f.id).join(",");

  // Load responses when the list of form IDs changes
  useEffect(() => {
    const load = async () => {
      const enriched = await Promise.all(
        forms.map(async (form) => {
          const responses = await fetchResponses(form.id);
          return toDashboardForm(form, responses as unknown as RawDbResponse[]);
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

  // Sync property changes (active, name, etc.) instantly without re-fetching responses
  useEffect(() => {
    if (dashboardForms.length === 0 || forms.length === 0) return;
    
    setDashboardForms(prev => {
      // If the lengths don't match, let the main load effect handle it to stay safe
      if (prev.length !== forms.length) return prev;
      
      let changed = false;
      const next = prev.map((df) => {
        // Find corresponding form by ID (safer than index)
        const f = forms.find(x => x.id === df.id);
        if (!f) return df;

        // Check for property changes that should be synced
        if (df.active !== f.active || df.name !== f.name || df.perk !== f.perk) {
          changed = true;
          return { ...df, ...f };
        }
        return df;
      });

      return changed ? next : prev;
    });
  }, [forms, dashboardForms.length]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFormCreatedThenEdit = async (formId: string) => {
    await fetchForms();
    setPendingEditFormId(formId);
    setView({ type: "list" });
    setIsDirty(false);
  };

  const handleFormUpdateSuccess = async () => {
    const enriched = await Promise.all(
      forms.map(async (form) => {
        const responses = await fetchResponses(form.id);
        return toDashboardForm(form, responses as unknown as RawDbResponse[]);
      }),
    );
    setDashboardForms(enriched);
  };

  const handleSearchChange = useCallback((s: string) => {
    setView((prev) =>
      prev.type === "responses" ? { ...prev, search: s } : prev,
    );
  }, []);

  const handleEditForm = async (formId: string) => {
    setIsFetchingForm(true);
    const freshForm = await fetchForm(formId);
    setIsFetchingForm(false);
    safeSetView({ type: "edit", formId, freshForm: freshForm ?? undefined });
  };

  const handlePageBuilderSave = useCallback(
    async (flow: CanvasFlow) => {
      const { error } = await updateForm(flow.id, {
        name: flow.name,
        questions: flow.steps as any,
      });
      if (error) throw error;
      setIsDirty(false);
      await handleFormUpdateSuccess();
    },
    [updateForm],
  );

  // ── Edit view — full screen ─────────────────────────────────────────────────

  if (view.type === "edit") {
    const form =
      view.freshForm ?? dashboardForms.find((f) => f.id === view.formId);
    if (isFetchingForm || (!form && formsLoading)) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <PageBuilder
        initialFlow={formToCanvasFlow(form)}
        onBack={() => safeSetView({ type: "list" })}
        onSave={handlePageBuilderSave}
      />
    );
  }

  // ── All other views ─────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {formsLoading || isFetchingForm ? (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view.type === "profile" ? (
        <ResponderProfile
          userId={view.userId}
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
                  return toDashboardForm(form, responses as unknown as RawDbResponse[]);
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
        <div className="max-w-md mx-auto w-full">
          <button
            onClick={() => safeSetView({ type: "list" })}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            ← Back to flows
          </button>
          <CreateFormSimple
            stores={stores}
            onCreateForm={createForm}
            onSuccess={handleFormCreatedThenEdit}
            onCancel={() => safeSetView({ type: "list" })}
            onDirtyChange={setIsDirty}
          />
        </div>
      ) : (
        <div>
         
          <FormsList
            forms={dashboardForms}
            onCreateForm={() => safeSetView({ type: "create" })}
            onViewResponses={(formId, search) =>
              safeSetView({ type: "responses", formId, search: search ?? "" })
            }
            onToggleFormActive={toggleFormActive}
            onDeleteForm={deleteForm}
            onEditForm={handleEditForm}
            businessName={profile?.business_name}
            businessLogo={profile?.business_logo}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
