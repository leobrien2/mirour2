"use client";

import { useState, useEffect } from "react";
import {
  LayoutGrid,
  PlusCircle,
  BarChart3,
  QrCode,
  LogOut,
  User,
  Menu,
  MessageSquare,
  Users,
  Store,
  Tag,
} from "lucide-react";
import { DashboardForm, toDashboardForm } from "@/types/dashboard";
import { FormsList } from "./FormsList";
import { FlowBuilder } from "./FlowBuilder";
import { CreateFormSimple } from "./CreateFormSimple";
import { Analytics } from "./Analytics";
import { Responders } from "./Responders";
import { RedemptionScanner } from "./RedemptionScanner";
import { Profile } from "./Profile";
import { ResponsesView } from "./ResponsesView";
import { ResponderProfile } from "./ResponderProfile";
import { StoreManager } from "@/components/dashboard/StoreManager";
import { TagManagerView } from "@/components/dashboard/TagManagerView";
import { useForms } from "@/hooks/useForms";
import { useResponses } from "@/hooks/useResponses";
import { useAuth } from "@/hooks/useAuth";
import { useStores } from "@/hooks/useStores";
import logoWordmark from "@/assets/mirour-logo-galaxy.png";

export function RetailerDashboard() {
  const { profile, signOut, updateProfile } = useAuth();
  const {
    forms,
    fetchForms,
    createForm,
    updateForm,
    deleteForm,
    toggleFormActive,
  } = useForms();
  const { stores } = useStores();
  const { fetchResponses, redeemByCode, updateResponseCustomerInfo } =
    useResponses();

  const [activeTab, setActiveTab] = useState<
    | "forms"
    | "create"
    | "analytics"
    | "customers"
    | "redeem"
    | "profile"
    | "stores"
    | "tags"
  >("forms");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewingResponsesFormId, setViewingResponsesFormId] = useState<
    string | null
  >(null);
  const [responsesInitialSearch, setResponsesInitialSearch] =
    useState<string>("");
  const [viewingUserProfileId, setViewingUserProfileId] = useState<
    string | null
  >(null);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [dashboardForms, setDashboardForms] = useState<DashboardForm[]>([]);
  const [pendingEditFormId, setPendingEditFormId] = useState<string | null>(
    null,
  );

  // Load responses for all forms
  useEffect(() => {
    const loadAllResponses = async () => {
      const formsWithResponses = await Promise.all(
        forms.map(async (form) => {
          const responses = await fetchResponses(form.id);
          return toDashboardForm(form, responses);
        }),
      );
      setDashboardForms(formsWithResponses);

      // If we have a pending edit, set it now that dashboardForms is ready
      if (
        pendingEditFormId &&
        formsWithResponses.some((f) => f.id === pendingEditFormId)
      ) {
        setEditingFormId(pendingEditFormId);
        setPendingEditFormId(null);
      }
    };

    if (forms.length > 0) {
      loadAllResponses();
    } else {
      setDashboardForms([]);
    }
  }, [forms, pendingEditFormId]);

  const tabs = [
    { id: "forms", label: "My Flows", icon: LayoutGrid },
    { id: "stores", label: "Locations", icon: Store },
    { id: "tags", label: "Tags", icon: Tag },
    { id: "customers", label: "Customers", icon: Users },
    // { id: 'redeem', label: 'Redeem', icon: QrCode }, // Hidden for now - brands use their own POS codes
    // { id: "analytics", label: "Analytics", icon: BarChart3 },
  ] as const;

  const handleNavigateToResponses = (
    formId: string,
    searchQuery: string = "",
  ) => {
    setViewingResponsesFormId(formId);
    setResponsesInitialSearch(searchQuery);
  };

  const handleUpdateProfile = async (name: string, logo: string | null) => {
    await updateProfile({
      business_name: name,
      business_logo: logo || undefined,
    });
  };

  const handleRedeem = async (code: string) => {
    await redeemByCode(code);
    // Refresh responses
    const formsWithResponses = await Promise.all(
      forms.map(async (form) => {
        const responses = await fetchResponses(form.id);
        return toDashboardForm(form, responses);
      }),
    );
    setDashboardForms(formsWithResponses);
  };

  const handleEditForm = (formId: string) => {
    setEditingFormId(formId);
  };

  const handleFormCreatedThenEdit = async (formId: string) => {
    // Refetch forms to get the newly created form with all its data
    await fetchForms();
    setActiveTab("forms");
    // Set pending edit - will be activated once dashboardForms updates
    setPendingEditFormId(formId);
  };

  const handleFormUpdateSuccess = async () => {
    // Refresh forms after update
    const formsWithResponses = await Promise.all(
      forms.map(async (form) => {
        const responses = await fetchResponses(form.id);
        return toDashboardForm(form, responses);
      }),
    );
    setDashboardForms(formsWithResponses);
    setEditingFormId(null);
    setActiveTab("forms");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-mirour-dark/95 backdrop-blur-md text-primary-foreground sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <img
                src={logoWordmark.src}
                alt="Mirour"
                className="h-6 brightness-0 invert"
              />
            </div>

            {/* Centre pill nav — desktop only */}
            <nav className="hidden md:flex items-center bg-white/10 rounded-full p-1 gap-0.5">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setViewingResponsesFormId(null);
                      setResponsesInitialSearch("");
                      setViewingUserProfileId(null);
                      setEditingFormId(null);
                    }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "bg-white text-mirour-dark shadow-md"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Right: avatar button */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/15"
                title="Menu"
              >
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="hidden sm:inline text-white/80 text-xs">
                  Menu
                </span>
                <Menu className="w-3.5 h-3.5 text-white/60" />
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-11 w-60 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden z-50">
                    {/* Mobile-only nav tabs */}
                    <div className="md:hidden">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id as any);
                              setViewingResponsesFormId(null);
                              setResponsesInitialSearch("");
                              setViewingUserProfileId(null);
                              setEditingFormId(null);
                              setIsMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {tab.label}
                          </button>
                        );
                      })}
                      <div className="border-t border-border" />
                    </div>

                    <button
                      onClick={() => {
                        setActiveTab("create");
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors"
                    >
                      <PlusCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      Create Flow
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("profile");
                        setViewingUserProfileId(null);
                        setViewingResponsesFormId(null);
                        setEditingFormId(null);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors"
                    >
                      <User className="w-4 h-4 text-primary flex-shrink-0" />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        window.open(
                          "mailto:hello@mirourmirour.com?subject=Feedback",
                          "_blank",
                        );
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
                      Give us feedback
                    </button>
                    <div className="border-t border-border" />
                    <button
                      onClick={() => {
                        signOut();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-fade-in">
          {viewingUserProfileId ? (
            <ResponderProfile
              userId={viewingUserProfileId}
              forms={dashboardForms}
              onBack={() => setViewingUserProfileId(null)}
              onNavigateToResponse={(formId, searchQuery) => {
                setViewingUserProfileId(null);
                setViewingResponsesFormId(formId);
                setResponsesInitialSearch(searchQuery);
              }}
              onUpdateCustomerInfo={async (responseId, updates) => {
                const result = await updateResponseCustomerInfo(
                  responseId,
                  updates,
                );
                if (!result.error) {
                  const formsWithResponses = await Promise.all(
                    forms.map(async (form) => {
                      const responses = await fetchResponses(form.id);
                      return toDashboardForm(form, responses);
                    }),
                  );
                  setDashboardForms(formsWithResponses);
                }
                return result;
              }}
            />
          ) : viewingResponsesFormId ? (
            <ResponsesView
              form={
                dashboardForms.find((f) => f.id === viewingResponsesFormId)!
              }
              onBack={() => {
                setViewingResponsesFormId(null);
                setResponsesInitialSearch("");
              }}
              initialSearch={responsesInitialSearch}
              onSearchChange={setResponsesInitialSearch}
              onNavigateToUserProfile={(userId) => {
                setViewingResponsesFormId(null);
                setResponsesInitialSearch("");
                setViewingUserProfileId(userId);
              }}
            />
          ) : (
            <>
              {activeTab === "forms" && !editingFormId && (
                <FormsList
                  forms={dashboardForms}
                  onCreateForm={() => setActiveTab("create")}
                  onViewResponses={handleNavigateToResponses}
                  onToggleFormActive={toggleFormActive}
                  onDeleteForm={deleteForm}
                  onEditForm={handleEditForm}
                  businessName={profile?.business_name}
                  businessLogo={profile?.business_logo}
                />
              )}
              {activeTab === "forms" && editingFormId && (
                <FlowBuilder
                  existingForm={dashboardForms.find(
                    (f) => f.id === editingFormId,
                  )}
                  onUpdateForm={updateForm}
                  onDeleteForm={deleteForm}
                  onSuccess={handleFormUpdateSuccess}
                  businessLogo={profile?.business_logo}
                />
              )}
              {activeTab === "create" && (
                <CreateFormSimple
                  stores={stores}
                  onCreateForm={createForm}
                  onSuccess={handleFormCreatedThenEdit}
                  onCancel={() => setActiveTab("forms")}
                />
              )}
              {activeTab === "analytics" && !editingFormId && (
                <Analytics
                  forms={dashboardForms}
                />
              )}
              {activeTab === "customers" && !editingFormId && (
                <Responders
                  onNavigateToUserProfile={(userId) =>
                    setViewingUserProfileId(userId)
                  }
                />
              )}
              {activeTab === "stores" && !editingFormId && (
                <StoreManager forms={dashboardForms} />
              )}
              {activeTab === "tags" && !editingFormId && <TagManagerView />}
              {activeTab === "redeem" && !editingFormId && (
                <RedemptionScanner
                  forms={dashboardForms}
                  onRedeem={handleRedeem}
                />
              )}
              {activeTab === "profile" && !editingFormId && (
                <Profile
                  businessName={profile?.business_name || ""}
                  businessLogo={profile?.business_logo || null}
                  onUpdateProfile={handleUpdateProfile}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
