"use client";

import { useState, useEffect } from "react";
import {
  X,
  Phone,
  Loader2,
  CheckCircle2,
  Bookmark,
  FileText,
  ShoppingBag,
  Trash2,
  User,
  Clock,
  LogOut,
  Pencil,
  Check,
  Mail,
} from "lucide-react";
import {
  lookupCustomerByPhone,
  getCustomerHistory,
  type CustomerHistory,
} from "@/services/customerLookup";
import {
  saveCustomerLocally,
  getLocalCustomer,
  type LocalCustomerProfile,
  clearCustomerLocally,
} from "@/lib/customerSession";
import { supabase } from "@/integrations/supabase/client";
import type { SavedItem } from "@/types/mirour";

interface CustomerProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  savedItems: SavedItem[];
  onRemoveSavedItem: (productId: string) => Promise<void>;
  onLogin: (customer: LocalCustomerProfile) => void;
  onLogout: () => void;
  customerId: string | null;
  allProducts?: any[];
}

type DrawerPhase = "login" | "profile";
type ProfileTab = "saved" | "history" | "account"; // ← ADD account tab

export function CustomerProfileDrawer({
  open,
  onClose,
  savedItems,
  onRemoveSavedItem,
  onLogin,
  onLogout,
  customerId,
  allProducts = [],
}: CustomerProfileDrawerProps) {
  const [phase, setPhase] = useState<DrawerPhase>(
    customerId ? "profile" : "login",
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>("saved");

  // ── Login state ────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // ── Profile state ──────────────────────────────────────────────────────────
  const [localCustomer, setLocalCustomer] =
    useState<LocalCustomerProfile | null>(null);
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ── Edit profile state ─────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // ── Sync phase when customerId changes externally ──────────────────────────
  useEffect(() => {
    if (customerId) {
      setPhase("profile");
      const local = getLocalCustomer();
      if (local?.id === customerId) setLocalCustomer(local);
    } else {
      setPhase("login");
    }
  }, [customerId]);

  // ── Load history when profile phase becomes active ─────────────────────────
  useEffect(() => {
    if (phase !== "profile" || !customerId || history) return;
    setHistoryLoading(true);
    getCustomerHistory(customerId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, [phase, customerId, history]);

  // ── Seed edit fields when switching to account tab ────────────────────────
  useEffect(() => {
    if (activeTab === "account" && localCustomer) {
      const nameParts = localCustomer.name?.split(" ") ?? [];
      setEditFields({
        firstName: localCustomer.firstname ?? nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") ?? "",
        email: localCustomer.email ?? "",
        phone: localCustomer.phone ?? "",
      });
      setIsEditing(false);
      setEditError(null);
      setEditSuccess(false);
    }
  }, [activeTab, localCustomer]);

  // ── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setPhone("");
        setLoginError(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!phone.trim()) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const customer = await lookupCustomerByPhone(phone);
      if (!customer) {
        setLoginError(
          "No account found with this number. Try the phone you used in the quiz.",
        );
        return;
      }
      saveCustomerLocally(customer);
      setLocalCustomer(customer);
      setPhase("profile");
      onLogin(customer);
    } catch {
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearCustomerLocally();
    setLocalCustomer(null);
    setHistory(null);
    setPhone("");
    setLoginError(null);
    setIsEditing(false);
    setPhase("login");
    onLogout();
  };

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await onRemoveSavedItem(productId);
    setRemovingId(null);
  };

  const handleSaveProfile = async () => {
    if (!customerId || !localCustomer) return;
    setEditSaving(true);
    setEditError(null);
    setEditSuccess(false);

    try {
      const fullName =
        [editFields.firstName, editFields.lastName].filter(Boolean).join(" ") ||
        null;

      const { error } = await (supabase as any)
        .from("customers")
        .update({
          name: fullName,
          first_name: editFields.firstName || null,
          email: editFields.email || null,
          phone: editFields.phone || null,
          last_active: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (error) {
        setEditError(error.message ?? "Failed to save changes.");
        return;
      }

      // Update localStorage immediately
      const updated: LocalCustomerProfile = {
        ...localCustomer,
        name: fullName,
        firstname: editFields.firstName || null,
        email: editFields.email || null,
        phone: editFields.phone || null,
      };
      saveCustomerLocally(updated);
      setLocalCustomer(updated);
      setEditSuccess(true);
      setIsEditing(false);

      // Flash success for 2s
      setTimeout(() => setEditSuccess(false), 2000);
    } catch (err: any) {
      setEditError(err?.message ?? "An unexpected error occurred.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!localCustomer) return;
    const nameParts = localCustomer.name?.split(" ") ?? [];
    setEditFields({
      firstName: localCustomer.firstname ?? nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" ") ?? "",
      email: localCustomer.email ?? "",
      phone: localCustomer.phone ?? "",
    });
    setEditError(null);
    setIsEditing(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const enrichedSavedItems = savedItems.map((item) => ({
    ...item,
    _product:
      (item as any).products ??
      allProducts.find((p) => p.id === item.product_id),
  }));

  const allSavedItems = history?.savedItems.length
    ? history.savedItems.map((item: any) => ({
        ...item,
        _product:
          item.products ??
          allProducts.find((p: any) => p.id === item.product_id),
      }))
    : enrichedSavedItems;

  const displayName =
    localCustomer?.firstname ??
    localCustomer?.name?.split(" ")[0] ??
    localCustomer?.email?.split("@")[0] ??
    "there";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto
          bg-background rounded-t-3xl shadow-2xl
          border-t border-border/50
          transition-transform duration-300 ease-out
          flex flex-col
          ${open ? "translate-y-0" : "translate-y-full pointer-events-none"}
        `}
        style={{ maxHeight: "88dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* ── LOGIN PHASE ─────────────────────────────────────────────────── */}
        {phase === "login" && (
          <div className="flex flex-col px-6 pb-8 pt-2">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground leading-tight">
                  Your profile
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Enter the phone you used in the quiz
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {enrichedSavedItems.length > 0 && (
              <div className="mb-5 p-3 rounded-2xl bg-primary/5 border border-primary/15">
                <p className="text-xs font-semibold text-primary mb-2.5 flex items-center gap-1.5">
                  <Bookmark className="w-3 h-3" />
                  {enrichedSavedItems.length} item
                  {enrichedSavedItems.length !== 1 ? "s" : ""} saved this
                  session
                </p>
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {enrichedSavedItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="w-12 h-12 rounded-xl bg-muted border border-border/40 shrink-0 overflow-hidden"
                    >
                      {item._product?.imageurl ? (
                        <img
                          src={item._product.imageurl}
                          alt={item._product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  ))}
                  {enrichedSavedItems.length > 5 && (
                    <div className="w-12 h-12 rounded-xl bg-muted border border-border/40 shrink-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-muted-foreground">
                        +{enrichedSavedItems.length - 5}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  Sign in to keep these across visits
                </p>
              </div>
            )}

            <div className="relative mb-3">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <input
                type="tel"
                placeholder="+1 555 000 0000"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setLoginError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoFocus={open}
                className="w-full pl-11 pr-4 py-4 rounded-2xl border border-border/60 bg-card text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
              />
            </div>

            {loginError && (
              <p className="text-xs text-destructive font-medium px-1 mb-3 animate-in fade-in">
                {loginError}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loginLoading || !phone.trim()}
              className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base hover:bg-foreground/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loginLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loginLoading ? "Looking up…" : "View my profile"}
            </button>

            <p className="text-[11px] text-center text-muted-foreground/40 mt-4">
              We only use this to retrieve your saved items &amp; quiz history
            </p>
          </div>
        )}

        {/* ── PROFILE PHASE ───────────────────────────────────────────────── */}
        {phase === "profile" && (
          <>
            {/* Header */}
            <div className="px-6 pt-2 pb-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground leading-tight">
                      Hey, {displayName}! 👋
                    </p>
                    {localCustomer?.phone && (
                      <p className="text-xs text-muted-foreground">
                        {localCustomer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs — now 3 */}
              <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 mt-4">
                {(["saved", "history", "account"] as ProfileTab[]).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                        activeTab === tab
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "saved" && <Bookmark className="w-3 h-3" />}
                      {tab === "history" && <FileText className="w-3 h-3" />}
                      {tab === "account" && <User className="w-3 h-3" />}
                      {tab === "saved"
                        ? "Saved"
                        : tab === "history"
                          ? "History"
                          : "Account"}
                      {tab === "saved" && allSavedItems.length > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "saved" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {allSavedItems.length}
                        </span>
                      )}
                      {tab === "history" &&
                        history &&
                        history.responses.length > 0 && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "history" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                          >
                            {history.responses.length}
                          </span>
                        )}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 pb-8">
              {/* ── Saved Items Tab ──────────────────────────────────────── */}
              {activeTab === "saved" && (
                <div className="space-y-3">
                  {allSavedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No saved items yet
                      </p>
                      <p className="text-xs text-muted-foreground/50 max-w-48">
                        Tap the bookmark icon on any product to save it here
                      </p>
                    </div>
                  ) : (
                    allSavedItems.map((item: any) => {
                      const p = item._product;
                      const isRemoving = removingId === item.product_id;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card transition-all duration-200 ${isRemoving ? "opacity-40 scale-[0.97]" : ""}`}
                        >
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/30">
                            {p?.imageurl ? (
                              <img
                                src={p.imageurl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="w-4 h-4 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                              {p?.name ?? "Product"}
                            </p>
                            {p?.price != null && (
                              <p className="text-xs font-bold text-primary mt-0.5">
                                ${Number(p.price).toFixed(2)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemove(item.product_id)}
                            disabled={isRemoving}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── History Tab ──────────────────────────────────────────── */}
              {activeTab === "history" && (
                <div className="space-y-3">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-14">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
                    </div>
                  ) : !history || history.responses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <FileText className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No submissions yet
                      </p>
                    </div>
                  ) : (
                    history.responses.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 rounded-2xl border border-border/40 bg-card space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {r.forms?.name ?? "Quiz"}
                          </p>
                          {r.perkredeemed && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                              Redeemed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(r.submittedat).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        {r.redemptioncode && !r.perkredeemed && (
                          <div className="flex items-center justify-between mt-1 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
                            <p className="text-xs text-muted-foreground">
                              Promo code
                            </p>
                            <p className="text-xs font-bold text-primary font-mono tracking-wider">
                              {r.redemptioncode}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Account Tab ──────────────────────────────────────────── */}
              {activeTab === "account" && (
                <div className="space-y-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Profile details
                    </p>
                    {!isEditing ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-all"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:bg-muted transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          disabled={editSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-50"
                        >
                          {editSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Save
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Success banner */}
                  {editSuccess && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Profile updated successfully
                    </div>
                  )}

                  {/* Error banner */}
                  {editError && (
                    <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in">
                      {editError}
                    </div>
                  )}

                  {/* Fields */}
                  <div className="space-y-3">
                    {/* First + Last name row */}
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                          First Name
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFields.firstName}
                            onChange={(e) =>
                              setEditFields((p) => ({
                                ...p,
                                firstName: e.target.value,
                              }))
                            }
                            placeholder="Jane"
                            className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
                          />
                        ) : (
                          <div className="px-4 py-3 rounded-2xl bg-muted/40 border border-border/40 text-sm text-foreground">
                            {editFields.firstName || (
                              <span className="text-muted-foreground/40">
                                Not set
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                          Last Name
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFields.lastName}
                            onChange={(e) =>
                              setEditFields((p) => ({
                                ...p,
                                lastName: e.target.value,
                              }))
                            }
                            placeholder="Doe"
                            className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
                          />
                        ) : (
                          <div className="px-4 py-3 rounded-2xl bg-muted/40 border border-border/40 text-sm text-foreground">
                            {editFields.lastName || (
                              <span className="text-muted-foreground/40">
                                Not set
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> Email
                      </label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editFields.email}
                          onChange={(e) =>
                            setEditFields((p) => ({
                              ...p,
                              email: e.target.value,
                            }))
                          }
                          placeholder="jane@example.com"
                          className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
                        />
                      ) : (
                        <div className="px-4 py-3 rounded-2xl bg-muted/40 border border-border/40 text-sm text-foreground">
                          {editFields.email || (
                            <span className="text-muted-foreground/40">
                              Not set
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> Phone
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editFields.phone}
                          onChange={(e) =>
                            setEditFields((p) => ({
                              ...p,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="+1 555 000 0000"
                          className="w-full px-4 py-3 rounded-2xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm placeholder:text-muted-foreground/30"
                        />
                      ) : (
                        <div className="px-4 py-3 rounded-2xl bg-muted/40 border border-border/40 text-sm text-foreground">
                          {editFields.phone || (
                            <span className="text-muted-foreground/40">
                              Not set
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Danger zone */}
                  <div className="pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground/50 mb-3 font-semibold uppercase tracking-wider">
                      Account
                    </p>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-destructive/20 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
