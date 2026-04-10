"use client";

import { useState, useEffect } from "react";
import {
  X,
  Phone,
  Loader2,
  Heart,
  ShoppingBag,
  Trash2,
  User,
  LogOut,
  ExternalLink,
  HeartOffIcon,
  HeartIcon,
} from "lucide-react";
import { lookupCustomerByPhone, createCustomer } from "@/services/customerLookup";
import {
  saveCustomerLocally,
  getLocalCustomer,
  type LocalCustomerProfile,
  clearCustomerLocally,
} from "@/lib/customerSession";
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

type DrawerPhase = "login" | "profile" | "signup";

// Extracted component to handle individual "Read more" state
// Extracted component to handle individual "Read more" state
function SavedProductCard({
  item,
  isRemoving,
  onRemove,
}: {
  item: any;
  isRemoving: boolean;
  onRemove: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const p = item._product;
  const imgSrc = p?.image_url ?? p?.imageurl;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-border/40 bg-card overflow-hidden transition-all duration-200 ${
        isRemoving
          ? "opacity-40 scale-[0.97]"
          : "active:scale-[0.99] active:border-border/60" // Replaced hover with active for mobile tap feedback
      }`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted overflow-hidden shrink-0">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={p?.name ?? ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-muted-foreground/20" />
          </div>
        )}

        {/* Mobile-optimized remove button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove(item.product_id);
          }}
          disabled={isRemoving}
          aria-label="Remove from favorites"
          className={`
    absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center
    shadow-sm border transition-all active:scale-90
    bg-primary text-primary-foreground border-primary
    disabled:opacity-70
  `}
        >
          {isRemoving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Heart className="w-3.5 h-3.5 fill-current" />
          )}
        </button>
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        {/* Name */}
        <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">
          {p?.name ?? "Product"}
        </p>

        {/* SKU */}
        {p?.sku && (
          <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
            {p.sku}
          </p>
        )}

        {/* Description with Read More toggle */}
        {p?.description && (
          <div className="flex flex-col gap-1 mt-0.5">
            <p
              className={`text-[11px] text-muted-foreground/60 leading-relaxed transition-all duration-300 ease-in-out ${
                isExpanded ? "line-clamp-none" : "line-clamp-2"
              }`}
            >
              {p.description}
            </p>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevents parent clicks
                setIsExpanded(!isExpanded);
              }}
              className="text-[10px] font-bold text-primary self-start active:opacity-70 active:scale-95 transition-all py-1"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          </div>
        )}

        {/* Spacer pushes CTA to bottom */}
        <div className="flex-1" />
      </div>
    </div>
  );
}

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
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [localCustomer, setLocalCustomer] =
    useState<LocalCustomerProfile | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      setPhase("profile");
      const local = getLocalCustomer();
      if (local?.id === customerId) setLocalCustomer(local);
    } else {
      setPhase("login");
    }
  }, [customerId]);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setPhone("");
        setName("");
        setEmail("");
        setLoginError(null);
        if (!customerId) setPhase("login");
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, customerId]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleLogin = async () => {
    if (!phone.trim()) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      const customer = await lookupCustomerByPhone(phone);
      if (!customer) {
        setPhase("signup");
        return;
      }
      saveCustomerLocally(customer);
      setLocalCustomer(customer);
      setPhase("profile");
      onLogin(customer);
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!phone.trim() || !name.trim()) {
      setLoginError("Please provide your name and phone number.");
      return;
    }
    setSignUpLoading(true);
    setLoginError(null);
    try {
      const customer = await createCustomer({
        phone: phone.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        first_name: name.trim().split(" ")[0]
      });
      if (!customer) {
        setLoginError("Failed to create account. Please try again.");
        return;
      }
      saveCustomerLocally(customer);
      setLocalCustomer(customer);
      setPhase("profile");
      onLogin(customer);
    } catch (error) {
      console.error("Signup error:", error);
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleLogout = () => {
    clearCustomerLocally();
    setLocalCustomer(null);
    setPhone("");
    setLoginError(null);
    setPhase("login");
    onLogout();
  };

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await onRemoveSavedItem(productId);
    setRemovingId(null);
  };

  const enrichedSavedItems = savedItems.map((item) => ({
    ...item,
    _product:
      (item as any).products ??
      allProducts.find((p) => p.id === item.product_id),
  }));

  const displayName =
    localCustomer?.firstname ??
    localCustomer?.name?.split(" ")[0] ??
    localCustomer?.email?.split("@")[0] ??
    "there";

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm hidden lg:block"
        onClick={onClose}
      />

      <div
        className={`
          fixed z-50 bg-background flex flex-col
          inset-0
          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
          lg:w-full lg:max-w-2xl lg:max-h-[90dvh] lg:rounded-3xl lg:shadow-2xl
          lg:border lg:border-border/50
          animate-in fade-in duration-200
          lg:slide-in-from-bottom-4
        `}
      >
        {phase === "login" && (
          <div className="flex flex-col h-full lg:h-auto lg:max-h-[90dvh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Your profile
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter the phone you used in the quiz
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
              {/* Session saved items preview */}
              {enrichedSavedItems.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15">
                  <p className="text-xs font-semibold text-red-600 mb-3 flex items-center gap-1.5">
                    <Heart
                      className="w-3 h-3 text-red-500"
                      fill="currentColor"
                    />
                    {enrichedSavedItems.length} item
                    {enrichedSavedItems.length !== 1 ? "s" : ""} saved this
                    session
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {enrichedSavedItems.slice(0, 8).map((item) => {
                      const imgSrc =
                        item._product?.image_url ?? item._product?.imageurl;
                      return (
                        <div
                          key={item.id}
                          className="w-12 h-12 rounded-xl bg-muted border border-border/40 shrink-0 overflow-hidden"
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={item._product?.name ?? ""}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {enrichedSavedItems.length > 8 && (
                      <div className="w-12 h-12 rounded-xl bg-muted border border-border/40 shrink-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">
                          +{enrichedSavedItems.length - 8}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-2.5">
                    Sign in to keep these across visits
                  </p>
                </div>
              )}

              {/* Phone input */}
              <div className="space-y-3 lg:max-w-sm lg:mx-auto lg:w-full">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                  <input
                    type="tel"
                    aria-label="Phone number"
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
                  <p className="text-xs text-destructive font-medium px-1 animate-in fade-in">
                    {loginError}
                  </p>
                )}
              </div>
            </div>

            {/* Footer CTA */}
            <div className="px-5 pb-8 pt-3 shrink-0 border-t border-border/40">
              <div className="lg:max-w-sm lg:mx-auto">
                <button
                  onClick={handleLogin}
                  disabled={loginLoading || !phone.trim()}
                  className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base hover:bg-foreground/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {loginLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loginLoading ? "Looking up…" : "View my profile"}
                </button>
                <p className="text-[11px] text-center text-muted-foreground/40 mt-3">
                  We only use this to retrieve your saved items &amp; quiz
                  history
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === "signup" && (
          <div className="flex flex-col h-full lg:h-auto lg:max-h-[90dvh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
              <div>
                <h2 className="text-base font-bold text-foreground">Sign Up</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Please provide your details</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
              <div className="space-y-3 lg:max-w-sm lg:mx-auto lg:w-full">
                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <input type="text" placeholder="Full name *" value={name} onChange={(e) => { setName(e.target.value); setLoginError(null); }} className="w-full pl-11 pr-4 py-4 rounded-2xl border border-border/60 bg-card text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm" />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <input type="tel" placeholder="Phone number *" value={phone} onChange={(e) => { setPhone(e.target.value); setLoginError(null); }} className="w-full pl-11 pr-4 py-4 rounded-2xl border border-border/60 bg-card text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm" />
                  </div>
                  <div className="relative">
                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <input type="email" placeholder="Email (optional)" value={email} onChange={(e) => { setEmail(e.target.value); setLoginError(null); }} className="w-full pl-11 pr-4 py-4 rounded-2xl border border-border/60 bg-card text-base text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm" />
                  </div>
                </div>
                {loginError && <p className="text-xs text-destructive font-medium px-1 animate-in fade-in">{loginError}</p>}
              </div>
            </div>
            <div className="px-5 pb-8 pt-3 shrink-0 border-t border-border/40">
              <div className="lg:max-w-sm lg:mx-auto">
                <button onClick={handleSignUp} disabled={signUpLoading || !phone.trim() || !name.trim()} className="w-full py-4 rounded-2xl bg-foreground text-background font-bold text-base hover:bg-foreground/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                  {signUpLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {signUpLoading ? "Creating account…" : "Sign Up"}
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "profile" && (
          <div className="flex flex-col h-full lg:h-auto lg:max-h-[90dvh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
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
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Section label */}
            <div className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">
                Saved Products
              </p>
              {enrichedSavedItems.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500">
                  {enrichedSavedItems.length}
                </span>
              )}
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {enrichedSavedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="w-7 h-7 text-muted-foreground/25" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      No saved products yet
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-1 max-w-[200px] mx-auto">
                      Tap the heart icon on any product to save it here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {enrichedSavedItems.map((item: any) => (
                    <SavedProductCard
                      key={item.id}
                      item={item}
                      isRemoving={removingId === item.product_id}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
