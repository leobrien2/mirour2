"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import {
  Loader2,
  Camera,
  X,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { FlowNode, WelcomeSection, Zone } from "@/types/mirour";
import {
  useFormAnalytics,
  getOrCreateVisitorId,
} from "@/hooks/useFormAnalytics";
import { uploadResponseImage } from "@/lib/storage";
import {
  identifyUser,
  trackFormStart,
  trackFormSubmission,
} from "@/lib/posthog";
import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import { evaluateProfile } from "@/lib/profile-engine";
import { saveItem, unsaveItem, getSavedItems } from "@/lib/savedItems";
import { logInteraction } from "@/lib/logger";

type FormData = {
  id: string;
  name: string;
  perk: string;
  questions: FlowNode[];
  capture_name: boolean;
  capture_email: boolean;
  capture_phone: boolean;
  active: boolean;
  store_id?: string;
  show_start_page?: boolean;
};

type ProfileData = {
  business_name: string;
  business_logo: string | null;
};

// Recommendation Node Component
function RecommendationNode({
  node,
  products,
  tags,
  answers,
  onNext,
  businessLogo,
  businessName,
  allFilteredAll = false,
  zoneFilteredAll = false,
  customerArchetype = null,
  skuProfileCopy = [],
  storeId,
  sessionId,
  customerId,
  storeProducts = [],
  onIdentify,
}: {
  node: FlowNode;
  products: any[];
  tags: any[];
  answers: Record<string, any>;
  onNext: () => void;
  businessLogo: string | null;
  businessName: string;
  allFilteredAll?: boolean;
  zoneFilteredAll?: boolean;
  customerArchetype?: any;
  skuProfileCopy?: any[];
  storeId?: string;
  sessionId?: string;
  customerId?: string;
  storeProducts?: any[];
  onIdentify?: (id: string) => void;
}) {
  const [savedProductIds, setSavedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [showCapture, setShowCapture] = useState(false);
  const [capturePhone, setCapturePhone] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [captureLinking, setCaptureLinking] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [activeTab, setActiveTab] = useState<"recommendations" | "saved">(
    "recommendations",
  );
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Logic to fetch initially saved items
  useEffect(() => {
    if (storeId && sessionId) {
      getSavedItems(storeId, sessionId, customerId).then((items) => {
        setSavedProductIds(new Set(items.map((i) => i.product_id)));
      });
    }
  }, [storeId, sessionId, customerId]);

  const toggleSave = async (productId: string) => {
    if (!storeId || !sessionId) return;

    const isSaved = savedProductIds.has(productId);

    // Optimistic UI
    setSavedProductIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(productId);
      else next.add(productId);
      return next;
    });
    console.log(
      "CUSTOMER ID",
      customerId,
      "PRODUCT ID",
      productId,
      "SESSION ID",
      sessionId,
      "STORE ID",
      storeId,
    );
    if (isSaved) {
      await unsaveItem(storeId, sessionId, productId, customerId);
    } else {
      await saveItem(storeId, sessionId, productId, customerId);
      logInteraction(
        storeId,
        sessionId,
        "item_saved",
        { product_id: productId },
        customerId,
      );
    }
  };

  // Logic to find matching products
  const collectedTags: string[] = [];

  // Iterate through answers to find collected tags
  // We need to look up the question nodes to see which option maps to which tags
  // But here we only have answers.
  // We need the form structure passed in or pre-calculate tags.
  // Let's pass 'collectedTags' directly if possible, or we calculate it here if we assume answers map to options.
  // Actually, conditionalNext has the tags. We need access to the form questions to map answers -> tags.
  // For now, let's assume we can pass a helper or the full form, but 'answers' is just values.
  // BETTER: Calculate collected tags in the parent component and pass them down.

  const handleNextClick = () => {
    if (!customerId && savedProductIds.size > 0 && !showCapture) {
      setShowCapture(true);
      return;
    }
    onNext();
  };

  const submitIdentity = async () => {
    if (!capturePhone.trim() || !storeId || !sessionId) {
      return;
    }
    setCaptureLinking(true);
    setCaptureError("");
    try {
      console.log("API CALL: submitIdentity - fetch customer by phone");
      const res = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: capturePhone,
          name: captureName || null,
          store_id: storeId,
        }),
      });

      const data = await res.json();

      console.log("API CALL: submitIdentity - fetch customer by phone", data);
      if (!res.ok) {
        if (res.status === 409) {
          setCaptureError("Phone number already exists");
        } else {
          setCaptureError(data.error || "Save failed");
        }
        return;
      }

      const newCustomerId = data.token;

      console.log(
        "API CALL: submitIdentity - fetch customer by phone",
        newCustomerId,
      );

      if (newCustomerId && sessionId) {
        console.log(
          "API CALL: submitIdentity - fetch customer by phone",
          storeId,
          sessionId,
          newCustomerId,
        );
        console.log("API CALL: submitIdentity - link anonymous session");
        await supabase.rpc("link_anonymous_session", {
          p_store_id: storeId,
          p_session_id: sessionId,
          p_customer_id: newCustomerId,
        });
        localStorage.setItem("mirour_token", newCustomerId);
        if (onIdentify) onIdentify(newCustomerId);
      }
      onNext();
    } catch (err) {
      console.error("Linking error", err);
      setCaptureError("An error occurred");
    } finally {
      setCaptureLinking(false);
    }
  };

  const ProductCard = ({
    product,
    customDesc,
  }: {
    product: any;
    customDesc: string | null;
  }) => (
    <div
      key={product.id}
      onClick={() => setSelectedProduct({ ...product, customDesc })}
      className="flex flex-col bg-white/5 p-3 md:p-4 rounded-2xl border border-white/10 hover:bg-white/10 hover:scale-[1.02] hover:shadow-xl hover:border-white/20 transition-all cursor-pointer group"
    >
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white/5 border border-white/10 mb-3 relative group-hover:border-white/20 transition-colors">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <span className="text-3xl">🛍️</span>
          </div>
        )}

        {/* Save Bookmark overlay button */}
        {storeId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSave(product.id);
            }}
            className="absolute top-2 right-2 p-2.5 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 transition-colors shadow-sm"
          >
            {savedProductIds.has(product.id) ? (
              <BookmarkCheck className="w-5 h-5 text-mirour-yellow" />
            ) : (
              <Bookmark className="w-5 h-5 text-white/80" />
            )}
          </button>
        )}
      </div>
      <div className="flex flex-col flex-1">
        <h3 className="text-white text-base font-semibold leading-snug mb-1 line-clamp-2">
          {product.name}
        </h3>
        {customDesc && (
          <p className="text-white/60 text-xs md:text-sm line-clamp-2 mb-2 leading-relaxed">
            {customDesc}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <p className="text-white/90 text-sm md:text-base font-mono font-medium">
            ${product.price}
          </p>
          <span className="text-xs font-medium text-white/50 bg-white/10 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
            View Details
          </span>
        </div>
      </div>
    </div>
  );

  const savedProducts = storeProducts.filter((p) => savedProductIds.has(p.id));

  // Determine which list to show based on active tab
  const displayProducts =
    activeTab === "recommendations"
      ? products // show all recommended products inline
      : savedProducts; // show all explicitly saved products

  return (
    <div className="fixed inset-0 bg-mirour-dark animate-fade-in">
      <div className="relative w-full h-full flex flex-col items-center pt-8 pb-12 px-0 sm:px-6 overflow-y-auto">
        <div className="flex-1 flex flex-col items-center w-full max-w-5xl py-4 sm:py-8 px-4 sm:px-0">
          <div className="w-20 h-20 mb-4 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl">✨</span>
            )}
          </div>

          <h2 className="text-white text-2xl lg:text-3xl text-center mb-2 px-4 leading-tight font-medium">
            {node.header || "Recommended for You"}
          </h2>
          <p className="text-white/70 text-center mb-8 px-4 text-sm lg:text-base max-w-lg">
            {node.content ||
              "Based on your answers, we think you'll love these:"}
          </p>

          {/* Tab Bar */}
          <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl mb-8 border border-white/20 w-fit mx-auto">
            <button
              onClick={() => setActiveTab("recommendations")}
              className={`px-6 md:px-8 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "recommendations"
                  ? "bg-white text-mirour-dark shadow-sm"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Recommended
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex items-center gap-2 px-6 md:px-8 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "saved"
                  ? "bg-white text-mirour-dark shadow-sm"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Saved
              {savedProductIds.size > 0 && (
                <span
                  className={`inline-flex items-center justify-center h-5 px-2 rounded-full text-xs ${activeTab === "saved" ? "bg-mirour-dark/10 text-mirour-dark" : "bg-white/20 text-white"}`}
                >
                  {savedProductIds.size}
                </span>
              )}
            </button>
          </div>

          <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 mb-8">
            {/* Render the selected tab's products */}
            {displayProducts.map((product) => {
              // Apply M4 Copy Override Logic only if it's a recommended list product
              // Or if we uniformly want to generate customDesc for them
              let customDesc = product.description;
              if (
                activeTab === "recommendations" &&
                customerArchetype &&
                skuProfileCopy &&
                skuProfileCopy.length > 0
              ) {
                const override = skuProfileCopy.find(
                  (c: any) =>
                    c.sku_id === product.id &&
                    c.profile_id === customerArchetype.id,
                );
                if (override && override.copy_text) {
                  customDesc = override.copy_text;
                }
              }

              // Apply dynamic variable substitution
              if (customDesc) {
                const drinkMap: Record<string, string> = {
                  "beer-ipa": "cold can",
                  "wine-rose": "glass of rosé",
                  cocktails: "cocktail ritual",
                  spirits: "evening drink",
                  "no-drink": "drink",
                };
                let q5Answer = answers["Q5"] || answers["q5"] || "drink";
                if (Array.isArray(q5Answer)) q5Answer = q5Answer[0] || "drink";
                const drinkTerm = drinkMap[q5Answer] || "drink";
                customDesc = customDesc.replace(/\{drink_type\}/g, drinkTerm);
              }

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  customDesc={customDesc}
                />
              );
            })}

            {displayProducts.length === 0 && (
              <div className="col-span-2 lg:col-span-4 text-center py-16 px-6 bg-white/5 rounded-3xl border border-white/10">
                {activeTab === "saved" ? (
                  <>
                    <Bookmark className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white text-xl font-medium mb-3">
                      No saved items yet
                    </p>
                    <p className="text-white/60 text-base max-w-sm mx-auto">
                      Click the bookmark icon on any product to save it here for
                      later.
                    </p>
                  </>
                ) : allFilteredAll ? (
                  <>
                    <p className="text-white text-xl font-medium mb-3">
                      No exact matches found
                    </p>
                    <p className="text-white/60 text-base max-w-sm mx-auto">
                      We couldn't find products matching all your requirements.
                      Please ask a team member for personalized help!
                    </p>
                  </>
                ) : zoneFilteredAll ? (
                  <>
                    <p className="text-white text-xl font-medium mb-3">
                      No matches in this zone
                    </p>
                    <p className="text-white/60 text-base max-w-sm mx-auto">
                      Try exploring other zones or ask a team member for
                      recommendations.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white text-xl font-medium mb-3">
                      Browse our shelves
                    </p>
                    <p className="text-white/60 text-base max-w-sm mx-auto">
                      We recommend browsing our full selection or asking a team
                      member for guidance.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="w-full max-w-sm mt-auto px-4 sm:px-0">
            <button
              onClick={handleNextClick}
              className="w-full py-4 px-6 bg-white border border-white/30 rounded-2xl text-mirour-dark font-medium hover:bg-gray-100 transition-all shadow-xl shadow-white/10"
            >
              Continue
            </button>
          </div>
        </div>
        <div className="mt-6 text-white/40 text-xs text-center pb-6">
          Powered by <span className="text-white/60">Mirour</span>
        </div>
      </div>

      {showCapture && (
        <div className="absolute inset-0 bg-mirour-dark z-50 flex flex-col items-center justify-center p-6 animate-fade-in relative">
          <button
            onClick={() => setShowCapture(false)}
            className="absolute top-6 right-6 p-2 text-white/60 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-20 h-20 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
            <BookmarkCheck className="w-10 h-10 text-mirour-yellow" />
          </div>

          <h2 className="text-white text-2xl font-semibold text-center mb-2 px-4 leading-tight">
            Save Items for Later?
          </h2>
          <p className="text-white/70 text-center mb-8 px-4 text-[15px] leading-relaxed max-w-sm">
            You've saved {savedProductIds.size} item
            {savedProductIds.size !== 1 ? "s" : ""}. Enter your details so we
            can text you your personalized list.
          </p>

          <div className="w-full max-w-sm space-y-4">
            <div>
              <input
                type="text"
                placeholder="Name (Optional)"
                value={captureName}
                onChange={(e) => setCaptureName(e.target.value)}
                className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15 focus:border-white/40 transition-all"
              />
            </div>
            <div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={capturePhone}
                onChange={(e) => setCapturePhone(e.target.value)}
                className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15 focus:border-white/40 transition-all"
              />
            </div>

            <p className="text-white/50 text-[11px] text-center px-2 mt-4">
              By entering your email or phone, you agree to receive messages
              from {businessName}. Unsubscribe anytime.
            </p>

            {captureError && (
              <p className="text-red-400 text-sm text-center font-medium mt-2">
                {captureError}
              </p>
            )}

            <button
              onClick={submitIdentity}
              disabled={captureLinking || !capturePhone.trim()}
              className="w-full py-4 px-6 bg-white text-mirour-dark rounded-2xl font-medium hover:bg-gray-100 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 mt-4 flex items-center justify-center h-14"
            >
              {captureLinking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Save & Continue"
              )}
            </button>
            <button
              onClick={onNext}
              className="w-full py-4 px-6 bg-transparent text-white/60 hover:text-white transition-all underline-offset-4 hover:underline text-sm font-medium"
            >
              No thanks, just continue
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in sm:p-6"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#1c1c1c] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-square sm:aspect-video bg-black/50 overflow-hidden shrink-0">
              {selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <span className="text-6xl">🛍️</span>
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-colors border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 className="text-2xl sm:text-3xl font-semibold text-white leading-tight">
                  {selectedProduct.name}
                </h2>
                {selectedProduct.price && (
                  <span className="text-xl sm:text-2xl font-mono font-medium text-white bg-white/10 px-3 py-1.5 rounded-xl shrink-0">
                    ${selectedProduct.price}
                  </span>
                )}
              </div>

              {/* Additional Tags rendering if available */}
              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedProduct.tags.slice(0, 5).map((t: any) => (
                    <span
                      key={t.id}
                      className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"
                    >
                      {t.name || t.id}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-white/80 text-base sm:text-lg leading-relaxed mb-8">
                {selectedProduct.customDesc ||
                  selectedProduct.description ||
                  "No specific description available for this item."}
              </p>

              <button
                onClick={() => toggleSave(selectedProduct.id)}
                className={`w-full py-4 px-6 rounded-2xl font-medium transition-all flex items-center justify-center gap-3 text-lg ${
                  savedProductIds.has(selectedProduct.id)
                    ? "bg-white/10 border border-white/20 text-white hover:bg-white/15"
                    : "bg-white text-mirour-dark hover:bg-gray-100 shadow-xl shadow-white/10"
                }`}
              >
                {savedProductIds.has(selectedProduct.id) ? (
                  <>
                    <BookmarkCheck className="w-6 h-6 text-mirour-yellow" />
                    Saved to your list
                  </>
                ) : (
                  <>
                    <Bookmark className="w-6 h-6" />
                    Save this item
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Photo Upload Component
function PhotoUploadQuestion({
  questionId,
  value,
  onChange,
  onNext,
  formId,
  sessionId,
}: {
  questionId: string;
  value: string | undefined;
  onChange: (value: string) => void;
  onNext: () => void;
  formId: string;
  sessionId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    setUploading(true);

    try {
      // Upload to storage instead of base64
      const publicUrl = await uploadResponseImage(file, formId, sessionId);

      if (publicUrl) {
        onChange(publicUrl);
      } else {
        // Fallback to base64 if upload fails
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          onChange(base64);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error("Upload error:", error);
      // Fallback to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        onChange(base64);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!value ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-6 px-6 bg-white/10 backdrop-blur-md border-2 border-dashed border-white/30 rounded-2xl text-white hover:bg-white/20 transition-all flex flex-col items-center gap-3"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <Camera className="w-8 h-8" />
              <span>Take or Upload Photo</span>
            </>
          )}
        </button>
      ) : (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Uploaded"
            className="w-full rounded-2xl border-2 border-white/30"
          />
          <button
            type="button"
            onClick={removePhoto}
            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {value && (
        <button
          type="button"
          onClick={onNext}
          className="w-full py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
        >
          Next
        </button>
      )}
    </div>
  );
}
function ProductShowcaseNode({
  node,
  storeProducts,
  businessLogo,
  businessName,
  onNext,
}: {
  node: FlowNode;
  storeProducts: any[];
  businessLogo: string | null;
  businessName: string;
  onNext: () => void;
}) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const pinnedProducts = (node.pinnedProductIds ?? [])
    .map((id) => storeProducts.find((p) => p.id === id))
    .filter(Boolean);

  const isCarousel = node.showcaseLayout === "carousel";

  return (
    <div className="fixed inset-0 bg-mirour-dark animate-fade-in overflow-y-auto">
      <div className="flex flex-col items-center pt-8 pb-16 px-4 sm:px-6 min-h-full">
        {/* Logo */}
        <div className="w-16 h-16 mb-4 rounded-full overflow-hidden shadow-2xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
          {businessLogo ? (
            <img
              src={businessLogo}
              alt={businessName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl">✨</span>
          )}
        </div>

        {/* Header */}
        {node.showcaseHeader && (
          <h2 className="text-white text-2xl font-medium text-center mb-2 px-4 leading-tight">
            {node.showcaseHeader}
          </h2>
        )}
        {node.showcaseSubheader && (
          <p className="text-white/70 text-center mb-6 px-4 text-sm max-w-md">
            {node.showcaseSubheader}
          </p>
        )}

        {/* Product Grid or Carousel */}
        {pinnedProducts.length === 0 ? (
          <div className="text-white/40 text-sm mt-8">No products to show.</div>
        ) : isCarousel ? (
          // ── Carousel ─────────────────────────────────────────────
          <div className="w-full max-w-xl overflow-x-auto pb-2">
            <div className="flex gap-4 px-4" style={{ width: "max-content" }}>
              {pinnedProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="w-44 flex-shrink-0 cursor-pointer"
                >
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-2">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">
                        🛍️
                      </div>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium line-clamp-2 leading-snug">
                    {product.name}
                  </p>
                  {product.price && (
                    <p className="text-white/60 text-xs mt-0.5 font-mono">
                      ${product.price}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── Grid ────────────────────────────────────────────────
          <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 gap-4 px-2">
            {pinnedProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="flex flex-col bg-white/5 p-3 rounded-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white/5 border border-white/10 mb-2 group-hover:border-white/20 transition-colors">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">
                      🛍️
                    </div>
                  )}
                </div>
                <p className="text-white text-sm font-semibold leading-snug line-clamp-2 mb-1">
                  {product.name}
                </p>
                {product.price && (
                  <p className="text-white/70 text-xs font-mono mt-auto">
                    ${product.price}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Continue button */}
        <div className="w-full max-w-sm mt-8 px-4">
          <button
            onClick={onNext}
            className="w-full py-4 px-6 bg-white border border-white/30 rounded-2xl text-mirour-dark font-medium hover:bg-gray-100 transition-all shadow-xl"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Product Detail Modal (same pattern as RecommendationNode) */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in sm:p-6"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#1c1c1c] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-square sm:aspect-video bg-black/50 overflow-hidden shrink-0">
              {selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-6xl">
                  🛍️
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full text-white/80 border border-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 className="text-2xl font-semibold text-white leading-tight">
                  {selectedProduct.name}
                </h2>
                {selectedProduct.price && (
                  <span className="text-xl font-mono font-medium text-white bg-white/10 px-3 py-1.5 rounded-xl shrink-0">
                    ${selectedProduct.price}
                  </span>
                )}
              </div>
              {selectedProduct.description && (
                <p className="text-white/80 text-base leading-relaxed">
                  {selectedProduct.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Sections Renderer for Welcome/Complete screens
function SectionsRenderer({
  sections,
  onOptionClick,
  disabled = false,
}: {
  sections: WelcomeSection[];
  onOptionClick: (option: { label: string; targetNodeId?: string }) => void;
  disabled?: boolean;
}) {
  return (
    <div className="w-full max-w-md space-y-4 mb-6">
      {sections.map((section) => {
        switch (section.type) {
          case "content":
            return (
              <div
                key={section.id}
                className="w-full flex flex-col items-center"
              >
                {section.imageUrl && (
                  <div className="w-full aspect-video rounded-2xl overflow-hidden bg-white/10 border border-white/20 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={section.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {section.text && (
                  <p className="text-white/80 text-center">{section.text}</p>
                )}
              </div>
            );
          case "link":
            const linkUrl = section.linkUrl || "#";
            const formattedUrl =
              linkUrl !== "#" &&
              !linkUrl.startsWith("http://") &&
              !linkUrl.startsWith("https://")
                ? `https://${linkUrl}`
                : linkUrl;
            return (
              <a
                key={section.id}
                href={formattedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 bg-white/80 backdrop-blur-md rounded-2xl text-mirour-dark font-medium hover:bg-white/90 transition-all shadow-lg flex items-center justify-center"
              >
                {section.linkTitle || "Learn More"}
              </a>
            );
          case "options":
            return (
              <div key={section.id} className="w-full space-y-3">
                {section.options?.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => onOptionClick(option)}
                    disabled={disabled}
                    className={`w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-lg hover:bg-white/20 transition-all shadow-lg ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            );
          case "product":
            return (
              <div key={section.id} className="w-full grid grid-cols-2 gap-3">
                {section.products?.map((product) => {
                  const formattedUrl =
                    product.linkUrl &&
                    product.linkUrl !== "#" &&
                    !product.linkUrl.startsWith("http://") &&
                    !product.linkUrl.startsWith("https://")
                      ? `https://${product.linkUrl}`
                      : product.linkUrl;

                  const content = (
                    <div className="flex flex-col">
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white/10 border border-white/20">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <span className="text-3xl">📦</span>
                          </div>
                        )}
                      </div>
                      <p className="text-white text-sm mt-2 font-medium">
                        {product.name}
                      </p>
                    </div>
                  );

                  return formattedUrl ? (
                    <a
                      key={product.id}
                      href={formattedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={product.id}>{content}</div>
                  );
                })}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export default function CustomerForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const formId = params?.formId as string;
  const zoneId = searchParams?.get("zone_id");
  const intent = searchParams?.get("intent");
  const started = searchParams?.get("started");
  const [form, setForm] = useState<FormData | null>(null);
  const [zoneData, setZoneData] = useState<Zone | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);
  const sessionCompletedRef = useRef(false); // ← ADD THIS

  // New state for Store/Products
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [storeTags, setStoreTags] = useState<any[]>([]); // To map IDs to names if needed, or just logic
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileRules, setProfileRules] = useState<any[]>([]);
  const [skuProfileCopy, setSkuProfileCopy] = useState<any[]>([]);
  const [customerProfile, setCustomerProfile] = useState<any>(null);

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [nodeHistory, setNodeHistory] = useState<string[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [quizScore, setQuizScore] = useState(0); // Track cumulative quiz score
  const [screen, setScreen] = useState<"flow" | "contact" | "thankyou">("flow");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (
      typeof sessionStorage !== "undefined" &&
      !sessionStorage.getItem("anon_id")
    ) {
      sessionStorage.setItem("anon_id", uuidv4());
    }
  }, []);

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" && formId) {
      if (currentNodeId)
        sessionStorage.setItem(`mirour_node_${formId}`, currentNodeId);
      sessionStorage.setItem(
        `mirour_history_${formId}`,
        JSON.stringify(nodeHistory),
      );
      sessionStorage.setItem(
        `mirour_answers_${formId}`,
        JSON.stringify(answers),
      );
    }
  }, [currentNodeId, nodeHistory, answers, formId]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [redemptionCode, setRedemptionCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Track whether the form response row was already inserted so retries don't duplicate it
  const submittedResponseIdRef = useRef<string | null>(null);
  const [matchedCompleteNode, setMatchedCompleteNode] =
    useState<FlowNode | null>(null); // Store score-matched complete node

  // M3 Profile Engine valuation
  const customerArchetype = useMemo(() => {
    if (profiles.length === 0) return null;
    return evaluateProfile(answers, profiles, profileRules);
  }, [answers, profiles, profileRules]);

  const calculateCollectedTags = useCallback(() => {
    if (!form) return [];

    // Debug Answers
    console.log("📝 Current Answers:", answers);

    const accumulatedTagIds = new Set<string>();

    form.questions.forEach((q) => {
      if (q.type === "question" && answers[q.id]) {
        const answer = answers[q.id];
        const selectedOptions = Array.isArray(answer) ? answer : [answer];

        selectedOptions.forEach((optVal) => {
          const logic = q.conditionalNext?.find(
            (c) => c.optionValue === optVal,
          );
          if (logic?.addTags) {
            logic.addTags.forEach((t) => accumulatedTagIds.add(t));
          }
        });
      }
    });

    return Array.from(accumulatedTagIds);
  }, [form, answers]);

  // Analytics tracking
  const visitorId = getOrCreateVisitorId();
  const {
    trackVisit,
    trackQrScan,
    startSession,
    updateProgress,
    completeSession,
    markAbandoned,
    recordJourney,
    trackLinkClick,
    // sessionId
  } = useFormAnalytics(formId);

  const sessionIdRef = useRef<string | null>(null);
  const hasTrackedVisit = useRef(false);
  const hasStartedSession = useRef(false);
  // Holds pending QR scan data until session ID is ready
  const pendingQrScanRef = useRef<{
    zoneId: string;
    zoneName: string | null;
    storeId: string;
  } | null>(null);

  // Get the current node
  const currentNode =
    form?.questions.find((n) => n.id === currentNodeId) || null;

  // Calculate progress based on visited nodes
  const questionNodes =
    form?.questions.filter((n) => n.type === "question") || [];
  const answeredCount = questionNodes.filter(
    (n) => answers[n.id] !== undefined,
  ).length;
  const progress =
    questionNodes.length > 0 ? (answeredCount / questionNodes.length) * 100 : 0;

  useEffect(() => {
    const fetchForm = async () => {
      if (!formId) {
        setError("Form not found");
        setLoading(false);
        return;
      }

      try {
        console.log("API CALL: fetchForm - fetch form details");
        const { data: formData, error: formError } = (await supabase
          .from("forms" as any)
          .select("*")
          .eq("id", formId)
          .single()) as { data: any; error: any };

        if (formError || !formData) {
          setError("This form is no longer available");
          setLoading(false);
          return;
        }

        const questions = Array.isArray(formData.questions)
          ? (formData.questions as FlowNode[])
          : [];

        setForm({
          id: formData.id,
          name: formData.name,
          perk: formData.perk,
          questions,
          capture_name: formData.capture_name,
          capture_email: formData.capture_email,
          capture_phone: formData.capture_phone,
          active: formData.active,
          store_id: formData.store_id, // Capture store_id
          show_start_page: formData.show_start_page,
        });

        if (formData.show_start_page && !intent && started !== "true") {
          router.push(
            `/start?form=${formData.id}&location=${formData.store_id || ""}`,
          );
          return;
        }

        // If form has store_id, fetch products and tags
        if (formData.store_id) {
          console.log(
            `🔍 [Supabase Debug] Attempting to fetch products for store_id: '${formData.store_id}'`,
          );
          console.log(
            `📋 [Supabase Query Equivalent]: SELECT * FROM products WHERE store_id = '${formData.store_id}';`,
          );

          console.log("API CALL: fetchForm - fetch store products and tags");
          const [productsRes, tagsRes] = await Promise.all([
            supabase
              .from("products" as any)
              .select("*, tags(*)")
              .eq("store_id", formData.store_id),
            supabase
              .from("tags" as any)
              .select("*")
              .eq("store_id", formData.store_id),
          ]);

          if (productsRes.data) {
            setStoreProducts(productsRes.data);
            console.log("📥 Fetched store products:", productsRes.data.length);
          }
          if (tagsRes.data) {
            setStoreTags(tagsRes.data);
            console.log("📥 Fetched store tags:", tagsRes.data.length);
          }
        }

        // Fetch global M3 data
        console.log("API CALL: fetchForm - fetch global M3 data");
        const [profilesRes, rulesRes, copyRes] = await Promise.all([
          supabase.from("profiles" as any).select("*"),
          supabase.from("profile_rules" as any).select("*"),
          supabase.from("sku_profile_copy" as any).select("*"),
        ]);
        if (profilesRes.data) setProfiles(profilesRes.data);
        if (rulesRes.data) setProfileRules(rulesRes.data);
        if (copyRes.data) setSkuProfileCopy(copyRes.data);

        // Fetch customer profile for M4 Deduplication
        const token =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("mirour_token")
            : null;
        if (token) {
          try {
            console.log("API CALL: fetchForm - customer lookup via API");
            const res = await fetch("/api/customers/lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, store_id: formData.store_id }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.profile) setCustomerProfile(data.profile);
            }
          } catch (e) {
            console.error("Customer fetch error", e);
          }
        }

        // Fetch Zone Data if zone_id is present
        if (zoneId) {
          try {
            console.log("API CALL: fetchForm - fetch zone data");
            const { data: zData, error: zError } = await supabase
              .from("zones" as any)
              .select("*")
              .eq("id", zoneId)
              .single();

            if (zError) {
              console.warn("Zone fetch error (possibly invalid ID):", zError);
              // Still queue a QR scan with just the zone ID
              if (formData.store_id) {
                pendingQrScanRef.current = {
                  zoneId,
                  zoneName: null,
                  storeId: formData.store_id,
                };
              }
            } else if (zData) {
              setZoneData(zData as any);
              console.log("✅ Zone data loaded:", (zData as any).name);
              // Queue QR scan log — will be flushed once session ID is ready
              if (formData.store_id) {
                pendingQrScanRef.current = {
                  zoneId,
                  zoneName: (zData as any).name ?? null,
                  storeId: formData.store_id,
                };
              }
            }
          } catch (zErr) {
            console.error("Zone fetch exception:", zErr);
          }
        }

        // Restore session state
        let restoredNodeId = null;
        if (typeof sessionStorage !== "undefined") {
          if (intent) {
            // If the user explicitly chose an intent, clear their previous session
            // to ensure they start fresh instead of jumping to the completed step.
            sessionStorage.removeItem(`mirour_node_${formId}`);
            sessionStorage.removeItem(`mirour_answers_${formId}`);
            sessionStorage.removeItem(`mirour_history_${formId}`);
          } else {
            const savedNode = sessionStorage.getItem(`mirour_node_${formId}`);
            const savedAnswers = sessionStorage.getItem(
              `mirour_answers_${formId}`,
            );
            const savedHistory = sessionStorage.getItem(
              `mirour_history_${formId}`,
            );

            if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
            if (savedHistory) setNodeHistory(JSON.parse(savedHistory));
            if (savedNode) restoredNodeId = savedNode;
          }
        }

        // Set initial node (or restored node)
        if (restoredNodeId) {
          setCurrentNodeId(restoredNodeId);
        } else if (questions.length > 0) {
          if (intent === "My Usual") {
            const bypassNode =
              questions.find((q) => q.type === "recommendation") ||
              questions.find((q) => q.type === "complete");
            if (bypassNode) {
              setCurrentNodeId(bypassNode.id);
            } else {
              setCurrentNodeId(questions[0].id);
            }
          } else {
            setCurrentNodeId(questions[0].id);
          }
        }

        // Fetch profile info using owner_id from form
        let profileData = null;
        try {
          const ownerId = (formData as any).owner_id;
          if (ownerId) {
            console.log("API CALL: fetchForm - fetch admin user profile");
            const { data: fallbackData } = await (supabase as any)
              .from("admin_users")
              .select("business_name, business_logo")
              .eq("id", ownerId)
              .single();
            profileData = fallbackData;
          }
        } catch (e) {
          console.log("Error fetching profile", e);
        }

        if (profileData) {
          setProfile(profileData);
        }

        // Track visit (only once per page load)
        if (!hasTrackedVisit.current) {
          hasTrackedVisit.current = true;
          trackVisit(zoneId || undefined);
          // Track form start in PostHog
          trackQrScan(formData.storeid, undefined, zoneId ?? undefined);
          trackFormStart(formId!, formData.name);
        }
      } catch (err) {
        console.error("Error fetching form:", err);
        setError("Failed to load form");
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId, trackVisit]);

  // Start session immediately when form loads (not when user clicks Continue)
  useEffect(() => {
    const initSessionOnLoad = async () => {
      if (form && !hasStartedSession.current) {
        hasStartedSession.current = true;
        const initialNodeId =
          form.questions.length > 0 ? form.questions[0].id : undefined;
        const newSessionId = await startSession(initialNodeId);
        if (newSessionId) {
          sessionIdRef.current = newSessionId;

          // Cross-location journey row — written once per session
          // storeId may not be on `form` yet if it loaded async;
          // we guard safely and skip if unavailable.
          if (form.store_id) {
            recordJourney(newSessionId, form.store_id);
          }

          // Flush pending QR scan — log now that we have a session ID
          if (pendingQrScanRef.current) {
            const {
              zoneId: pZoneId,
              zoneName,
              storeId,
            } = pendingQrScanRef.current;
            pendingQrScanRef.current = null;
            logInteraction(
              storeId,
              newSessionId,
              "qr_scan",
              {
                zone_id: pZoneId,
                zone_name: zoneName,
                form_id: formId,
                scanned_at: new Date().toISOString(),
              },
              // customer_id intentionally omitted — unknown at scan time
            );
            console.log("📲 QR scan logged for zone:", zoneName ?? pZoneId);
          }
        }
      }
    };

    initSessionOnLoad();
  }, [form, startSession]);

  // Handle page unload to mark abandoned sessions
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionIdRef.current && screen !== "thankyou") {
        markAbandoned();
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        sessionIdRef.current &&
        screen !== "thankyou"
      ) {
        // Use sendBeacon for reliable delivery on mobile
        markAbandoned();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [markAbandoned, screen]);

  const generateRedemptionCode = () => {
    return "MIR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const goToNextNode = useCallback(
    (answer?: any) => {
      if (!form || !currentNode) return;

      // Track history
      setNodeHistory((prev) => [...prev, currentNode.id]);

      // M2 Hard Branch logic
      if (
        currentNode.id === "Q3" &&
        (answer === "no" || answers["Q3"] === "no")
      ) {
        setCurrentNodeId("Q4"); // skip Q5
        updateProgress("Q4");
        return;
      }

      // For choice questions, check conditional routing
      if (
        currentNode.type === "question" &&
        currentNode.conditionalNext &&
        answer
      ) {
        const conditionalMatch = currentNode.conditionalNext.find(
          (c) => c.optionValue === answer,
        );
        if (conditionalMatch) {
          const targetNode = form.questions.find(
            (n) => n.id === conditionalMatch.nextNodeId,
          );
          if (targetNode) {
            setCurrentNodeId(targetNode.id);
            // Track progress
            updateProgress(targetNode.id);
            return;
          }
        }
      }

      // Check if there's a default next node
      if (currentNode.nextNodeId) {
        const targetNode = form.questions.find(
          (n) => n.id === currentNode.nextNodeId,
        );
        if (targetNode) {
          setCurrentNodeId(targetNode.id);
          // Track progress
          updateProgress(targetNode.id);
          return;
        }
      }

      // Fall back to next node in array
      const currentIndex = form.questions.findIndex(
        (n) => n.id === currentNodeId,
      );
      if (currentIndex < form.questions.length - 1) {
        const nextNode = form.questions[currentIndex + 1];
        setCurrentNodeId(nextNode.id);
        // Track progress
        updateProgress(nextNode.id);
      }
    },
    [form, currentNode, currentNodeId, updateProgress],
  );

  // Get complete node for score - must be before any early returns
  const getCompleteNodeForScore = useCallback(() => {
    if (!form) return null;

    // Find all complete nodes with score thresholds
    const scoreResultNodes = form.questions.filter(
      (n) => n.type === "complete" && n.isScoreResult && n.scoreThreshold,
    );

    // Find one that matches the current score
    const matched = scoreResultNodes.find(
      (n) =>
        n.scoreThreshold &&
        quizScore >= n.scoreThreshold.min &&
        quizScore <= n.scoreThreshold.max,
    );

    if (matched) return matched;

    // Fall back to the first complete node without score threshold (default)
    return (
      form.questions.find((n) => n.type === "complete" && !n.isScoreResult) ||
      form.questions.find((n) => n.type === "complete")
    );
  }, [form, quizScore]);

  const handleAnswer = useCallback(
    (answer: any) => {
      if (!currentNode) return;
      setAnswers((prev) => ({ ...prev, [currentNode.id]: answer }));
      setErrorMessage("");

      // Calculate score for quiz questions
      if (
        currentNode.questionType === "quiz" &&
        currentNode.options &&
        currentNode.optionScores
      ) {
        const answerIndex = currentNode.options.indexOf(answer);
        if (
          answerIndex !== -1 &&
          currentNode.optionScores[answerIndex] !== undefined
        ) {
          setQuizScore((prev) => prev + currentNode.optionScores![answerIndex]);
        }
      }

      // Track the answer
      updateProgress(currentNode.id, {
        questionId: currentNode.id,
        value: answer,
      });

      setTimeout(() => {
        // Check if this was the last question before complete
        const nextIndex = form?.questions.findIndex(
          (n) => n.id === currentNodeId,
        );
        const nextNode =
          nextIndex !== undefined && form
            ? form.questions[nextIndex + 1]
            : null;

        if (nextNode?.type === "complete") {
          // We're about to hit the complete, check if we need contact info (via customer-info node)
          const customerInfoNode = form?.questions.find(
            (n) => n.type === "customer-info",
          );
          if (customerInfoNode) {
            // Navigate to customer-info node
            setCurrentNodeId(customerInfoNode.id);
            updateProgress(customerInfoNode.id);
            return;
          }
        }

        goToNextNode(answer);
      }, 300);
    },
    [currentNode, form, currentNodeId, updateProgress, goToNextNode],
  );

  const handleContinue = useCallback(() => {
    goToNextNode();
  }, [goToNextNode]);

  const handleBack = useCallback(() => {
    setNodeHistory((prev) => {
      const newHistory = [...prev];
      const prevNodeId = newHistory.pop();
      if (prevNodeId) {
        setCurrentNodeId(prevNodeId);
      }
      return newHistory;
    });
  }, []);

  const replacePlaceholders = (text?: string): string => {
    if (!text) return "";
    if (!zoneData) return text;

    return text
      .replace(/\{\{zone_name\}\}/g, zoneData.name)
      .replace(/\{\{zone_what\}\}/g, zoneData.zone_what || "")
      .replace(/\{\{zone_when\}\}/g, zoneData.zone_when || "")
      .replace(/\{\{zone_who\}\}/g, zoneData.zone_who || "");
  };

  const submitResponse = async (navigateOnSuccess = true): Promise<boolean> => {
    if (!form || submitting) return false;

    // ✅ Mutex — prevent concurrent duplicate calls
    if (isSubmittingRef.current) {
      console.warn(
        "submitResponse already in progress, skipping duplicate call",
      );
      return false;
    }
    isSubmittingRef.current = true;

    console.log("API CALL: submitResponse");
    setSubmitting(true);
    const code = generateRedemptionCode();

    try {
      // Determine if this flow has a perk
      const completeNodeForSubmit = getCompleteNodeForScore();
      const flowHasPerk =
        completeNodeForSubmit?.hasPerk && completeNodeForSubmit?.perk;

      // Include quiz score in answers if there were quiz questions
      const answersWithScore =
        quizScore > 0 ? { ...answers, _quizScore: quizScore } : answers;

      let finalPhone = customerPhone || null;
      if (finalPhone) {
        try {
          finalPhone = parsePhoneNumber(finalPhone, "US").format("E.164");
        } catch (e) {
          // ignore formatting errors here, validated earlier
        }
      }

      // ----------------------------------------------------------------
      // Save/Merge Customer Profile FIRST (before inserting response row)
      // so we can block the user on phone conflicts before any data is written
      // ----------------------------------------------------------------
      let currentCustomerId = customerProfile?.id || null;

      if (form.store_id && (customerEmail || customerPhone)) {
        const accumulatedTags = calculateCollectedTags();
        console.log("💾 Saving profile with tags:", accumulatedTags);

        try {
          console.log("API CALL: onSubmit - create customer via API");
          const createRes = await fetch("/api/customers/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              store_id: form.store_id, // ✅ fixed key name
              email: customerEmail || null,
              phone: finalPhone || customerPhone,
              name: customerName || null,
              tags: accumulatedTags,
            }),
          });
          console.log("API CALL: create customer - response", createRes);

          if (!createRes.ok) {
            const result = await createRes.json();
            console.error("❌ Profile save failed:", result.error);

            if (createRes.status === 409) {
              setErrorMessage(
                result.error ||
                  "That contact info is already registered. Please use a different one.",
              );
              setSubmitting(false);
              isSubmittingRef.current = false; // ✅ release lock on early return
              return false;
            } else {
              setErrorMessage(
                result.error ||
                  "We couldn't save your profile. Please try again.",
              );
              setSubmitting(false);
              isSubmittingRef.current = false; // ✅ release lock on early return
              return false;
            }
          }

          const createResult = await createRes.json();
          console.log("✅ Profile created/found:", createResult);

          if (createResult.profile?.id) {
            currentCustomerId = createResult.profile.id;
            setCustomerProfile((prev: any) => ({
              ...(prev || {}),
              ...createResult.profile,
            }));

            // ✅ Backfill customer_id on the anonymous qr_scan row
            // and increment visit_count now that we have the customer
            if (form.store_id && sessionIdRef.current) {
              await (supabase as any)
                .from("interactions")
                .update({ customer_id: currentCustomerId })
                .eq("session_id", sessionIdRef.current)
                .eq("event_type", "qr_scan")
                .is("customer_id", null);

              await (supabase as any).rpc("increment_customer_visit_count", {
                p_customer_id: currentCustomerId,
              });
            }
          }
        } catch (netErr) {
          console.error("❌ Network error saving profile:", netErr);
          setErrorMessage("Network connection error. Please try again.");
          setSubmitting(false);
          isSubmittingRef.current = false; // ✅ release lock on early return
          return false;
        }
      }

      // ----------------------------------------------------------------
      // Only insert the response row if we haven't already (prevents
      // duplicate rows if the user retries after a recoverable error)
      // ----------------------------------------------------------------
      let responseId = submittedResponseIdRef.current;
      console.log("API CALL: onSubmit - responseId", responseId);

      if (!responseId) {
        console.log("API CALL: onSubmit - insert form response");
        const { data: responseData, error: submitError } = await supabase
          .from("responses")
          .insert({
            form_id: formId,
            customer_id: currentCustomerId,
            customer_name: customerName || null,
            customer_email: customerEmail || null,
            customer_phone: finalPhone,
            answers: {
              ...answersWithScore,
              _meta: {
                zone_id: zoneId,
                visitor_id: visitorId,
                user_agent: window.navigator.userAgent,
              },
            },
            redemption_code: flowHasPerk ? code : `NO-PERK-${code}`,
            perk_redeemed: !flowHasPerk,
          })
          .select("id")
          .single();

        if (submitError) {
          console.error("Submit error:", submitError);

          // Same customer filling the same form again — find their existing response
          if (submitError.code === "23505") {
            const { data: existingResponse } = await supabase
              .from("responses")
              .select("id")
              .eq("form_id", formId)
              .eq("customer_id", currentCustomerId)
              .single();

            if (existingResponse?.id) {
              // Reuse the existing response ID and proceed to thank you
              submittedResponseIdRef.current = existingResponse.id;
              if (!sessionCompletedRef.current) {
                sessionCompletedRef.current = true;
                await completeSession(
                  existingResponse.id,
                  currentCustomerId ?? undefined,
                );
              }
              setSubmitting(false);
              isSubmittingRef.current = false;
              if (navigateOnSuccess) {
                setScreen("thankyou");
                window.scrollTo(0, 0);
              }
              return true; // ✅ Proceed normally
            }
          }

          setErrorMessage("Failed to submit response. Please try again.");
          setSubmitting(false);
          isSubmittingRef.current = false;
          return false;
        }

        responseId = responseData?.id ?? null;
        submittedResponseIdRef.current = responseId;

        if (responseId && Object.keys(answersWithScore).length > 0) {
          const insertPayload = Object.entries(answersWithScore).map(
            ([qId, val]) => ({
              response_id: responseId,
              form_id: formId,
              question_id: qId,
              answer_value: String(val),
            }),
          );

          const { error: answersErr } = await (supabase as any)
            .from("submission_answers")
            .insert(insertPayload);

          if (answersErr) {
            console.error("Error inserting submission answers:", answersErr);
            // Non-fatal — main response already saved
          }
        }
      }

      console.log("API CALL: onSubmit - currentCustomerId", currentCustomerId);
      console.log("API CALL: onSubmit - responseId", responseId);
      console.log(
        "API CALL: onSubmit - sessionCompletedRef",
        sessionCompletedRef.current,
      );

      // ✅ Only complete session ONCE — first call wins
      if (responseId && !sessionCompletedRef.current) {
        sessionCompletedRef.current = true;
        console.log("API CALL: onSubmit - complete session", responseId);
        await completeSession(responseId, currentCustomerId ?? undefined);
      }

      setSubmitting(false);
      isSubmittingRef.current = false; // ✅ release lock on success

      if (navigateOnSuccess) {
        setScreen("thankyou");
        window.scrollTo(0, 0);
      }
      return true;
    } catch (err) {
      console.error("Unexpected error:", err);
      setErrorMessage("An unexpected error occurred");
      setSubmitting(false);
      isSubmittingRef.current = false; // ✅ release lock on catch
      return false;
    }
  };

  const handleContactSubmit = () => {
    console.log("API CALL: handleContactSubmit");
    if (!form) return;
    console.log("API CALL: handleContactSubmit - form", form);
    console.log("API CALL: handleContactSubmit - customerName", customerName);
    console.log("API CALL: handleContactSubmit - customerEmail", customerEmail);
    console.log("API CALL: handleContactSubmit - customerPhone", customerPhone);

    if (form.capture_name && !customerName.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }
    if (form.capture_email && !customerEmail.trim()) {
      setErrorMessage("Please enter your email");
      return;
    }
    if (form.capture_phone && !customerPhone.trim()) {
      setErrorMessage("Please enter your phone number");
      return;
    }

    if (customerPhone.trim()) {
      if (!isValidPhoneNumber(customerPhone, "US")) {
        setErrorMessage("Please enter a valid phone number");
        return;
      }
    }

    // Identify user in PostHog when they provide contact info

    console.log("API CALL: handleContactSubmit - identifyUser");
    identifyUser(
      customerEmail || undefined,
      customerName || undefined,
      customerPhone || undefined,
    );

    console.log("API CALL: handleContactSubmit - submitResponse");
    submitResponse();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-mirour-dark flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="fixed inset-0 bg-mirour-dark flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">😔</div>
          <h1 className="text-white text-2xl mb-2">Form Unavailable</h1>
          <p className="text-white/70">
            {error || "This form is no longer available"}
          </p>
        </div>
      </div>
    );
  }

  const businessName = profile?.business_name || "Feedback";
  const businessLogo = profile?.business_logo || null;

  // Contact Information Screen
  if (screen === "contact") {
    return (
      <div className="fixed inset-0 bg-mirour-dark animate-fade-in">
        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-24 overflow-y-auto">
          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            {businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">🪞</span>
            )}
          </div>

          <h2 className="text-white text-2xl text-center mb-6 px-4 leading-tight">
            Finish to get your reward!
          </h2>

          <div className="w-full max-w-md space-y-4 mb-6">
            {form.capture_name && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">
                  Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {form.capture_email && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {form.capture_phone && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    // Clear phone-related errors when user starts typing
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="(555) 123-4567"
                  className={`w-full py-4 px-6 bg-white/10 backdrop-blur-md border rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15 transition-colors ${
                    errorMessage && errorMessage.includes("phone")
                      ? "border-red-400/70 bg-red-500/10"
                      : "border-white/20"
                  }`}
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
          )}

          <p className="text-white/50 text-[11px] text-center px-4 max-w-md mb-4 leading-relaxed">
            By entering your email or phone, you agree to receive messages from{" "}
            {businessName}. Unsubscribe anytime.
          </p>

          <button
            onClick={handleContactSubmit}
            disabled={submitting}
            className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Continue"}
          </button>

          <div className="mt-4 text-white/40 text-xs text-center">
            Powered by{" "}
            <a
              href="https://mirourmirour.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              Mirour
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-primary to-mirour-yellow w-full" />
        </div>
      </div>
    );
  }

  // Get perk from complete node - use matched score-based result or default complete node
  const completeNode = matchedCompleteNode || getCompleteNodeForScore();
  const hasPerk = completeNode?.hasPerk && completeNode?.perk;
  const perkText = completeNode?.perk || "";

  // Thank You Screen
  if (screen === "thankyou") {
    return (
      <div className="fixed inset-0 bg-mirour-dark animate-fade-in">
        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-24 overflow-y-auto">
          {/* Logo */}
          {businessLogo ? (
            <div className="w-28 h-28 rounded-full overflow-hidden bg-white/10 border border-white/20 mb-6 flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-6 flex-shrink-0">
              <span className="text-3xl">🪞</span>
            </div>
          )}

          <h2 className="text-white text-3xl text-center mb-2 px-4">
            {completeNode?.header || "Thank You!"}
          </h2>
          <p className="text-white/70 text-center mb-6 px-4">
            {completeNode?.content ||
              "Thanks for helping shape what we do next."}
          </p>

          {/* Render custom sections from complete node */}
          {completeNode?.sections && completeNode.sections.length > 0 && (
            <SectionsRenderer
              sections={completeNode.sections}
              onOptionClick={() => {}} // No navigation on thank you screen
            />
          )}

          {hasPerk && (
            <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-4 mb-4">
              <p className="text-xl text-white text-center">{perkText}</p>

              {completeNode?.perkCode && (
                <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4">
                  <p className="text-2xl tracking-widest text-white text-center font-mono">
                    {completeNode.perkCode}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 text-white/40 text-xs text-center">
            Powered by{" "}
            <a
              href="https://mirourmirour.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              Mirour
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-primary to-mirour-yellow w-full" />
        </div>
      </div>
    );
  }

  // Handle section option click - navigate to target node
  const handleSectionOptionClick = (option: {
    label: string;
    targetNodeId?: string;
  }) => {
    if (option.targetNodeId) {
      const targetNode = form?.questions.find(
        (n) => n.id === option.targetNodeId,
      );
      if (targetNode) {
        setCurrentNodeId(targetNode.id);
        return;
      }
    }
    // If no target, just continue
    handleContinue();
  };

  // Welcome Screen
  if (currentNode?.type === "welcome") {
    return (
      <div className="fixed inset-0 bg-mirour-dark animate-fade-in">
        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-12 overflow-y-auto">
          <p className="text-white text-xl font-medium mb-4 text-center">
            {businessName}
          </p>

          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            {currentNode.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentNode.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">🪞</span>
            )}
          </div>

          <h2 className="text-white text-3xl text-center mb-2 px-4 leading-tight">
            {replacePlaceholders(currentNode.header) || "Welcome!"}
          </h2>

          {currentNode.content && (
            <p className="text-white/70 text-center mb-6 px-4">
              {replacePlaceholders(currentNode.content)}
            </p>
          )}

          {/* Render custom sections */}
          {currentNode.sections && currentNode.sections.length > 0 && (
            <SectionsRenderer
              sections={currentNode.sections}
              onOptionClick={handleSectionOptionClick}
            />
          )}

          {(currentNode.buttonText === undefined ||
            currentNode.buttonText.trim() !== "") && (
            <button
              onClick={handleContinue}
              className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {currentNode.buttonText || "Get Started"}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}

          <div className="mt-4 text-white/40 text-xs text-center">
            Powered by{" "}
            <a
              href="https://mirourmirour.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              Mirour
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Message Screen
  if (currentNode?.type === "message") {
    return (
      <div className="fixed inset-0 bg-mirour-dark animate-fade-in">
        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-12 overflow-y-auto">
          <p className="text-white text-xl font-medium mb-4 text-center">
            {businessName}
          </p>

          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            {currentNode.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentNode.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">💬</span>
            )}
          </div>

          {currentNode.header && (
            <h2 className="text-white text-2xl font-semibold text-center mb-2 px-4">
              {replacePlaceholders(currentNode.header)}
            </h2>
          )}
          {currentNode.subheader && (
            <p className="text-white/80 text-base text-center mb-6 px-4 leading-relaxed">
              {replacePlaceholders(currentNode.subheader)}
            </p>
          )}
          {!currentNode.header && !currentNode.subheader && (
            <p className="text-white/60 text-base text-center mb-6 px-4">
              Content card
            </p>
          )}

          {/* External link button if available */}
          {currentNode.linkUrl && currentNode.linkUrl.trim() !== "" && (
            <a
              href={currentNode.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-md py-4 px-6 mb-4 bg-white/80 backdrop-blur-md rounded-2xl text-mirour-dark font-medium hover:bg-white/90 transition-all shadow-lg flex items-center justify-center"
            >
              {currentNode.linkTitle || "Learn More"}
            </a>
          )}

          <button
            onClick={handleContinue}
            className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
          >
            Continue
          </button>

          <div className="mt-4 text-white/40 text-xs text-center">
            Powered by{" "}
            <a
              href="https://mirourmirour.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              Mirour
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-primary to-mirour-yellow transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Customer Info Screen
  if (currentNode?.type === "customer-info") {
    const captureFields = currentNode.captureFields || {
      name: false,
      email: false,
      phone: false,
    };

    const handleCustomerInfoSubmit = async () => {
      const isRequired = currentNode.contactRequired ?? false;

      if (isRequired) {
        if (captureFields.name && !customerName.trim()) {
          setErrorMessage("Please enter your name");
          return;
        }
        if (captureFields.email && !customerEmail.trim()) {
          setErrorMessage("Please enter your email");
          return;
        }
        if (captureFields.phone && !customerPhone.trim()) {
          setErrorMessage("Please enter your phone number");
          return;
        }
      }

      if (customerPhone.trim()) {
        if (!isValidPhoneNumber(customerPhone, "US")) {
          setErrorMessage("Please enter a valid phone number");
          return;
        }
      }

      setErrorMessage("");
      // Pass false so submitResponse only saves data without forcing the
      // thank-you screen — goToNextNode() will advance to the recommendation node.
      const success = await submitResponse(false);

      if (success) {
        goToNextNode();
      }
    };

    return (
      <div className="fixed inset-0 bg-mirour-dark animate-fade-in">
        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-24 overflow-y-auto">
          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
            {businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessLogo}
                alt={businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl">🪞</span>
            )}
          </div>

          <h2 className="text-white text-2xl text-center mb-6 px-4 leading-tight">
            {currentNode.content || "Almost done! Share your info."}
          </h2>

          <div className="w-full max-w-md space-y-4 mb-6">
            {captureFields.name && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">
                  Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {captureFields.email && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {captureFields.phone && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="(555) 123-4567"
                  className={`w-full py-4 px-6 bg-white/10 backdrop-blur-md border rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15 transition-colors ${
                    errorMessage && errorMessage.includes("phone")
                      ? "border-red-400/70 bg-red-500/10"
                      : "border-white/20"
                  }`}
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
          )}

          <p className="text-white/50 text-[11px] text-center px-4 max-w-md mb-4 leading-relaxed">
            By entering your email or phone, you agree to receive messages from{" "}
            {businessName}. Unsubscribe anytime.
          </p>

          <button
            onClick={handleCustomerInfoSubmit}
            disabled={submitting}
            className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Continue"}
          </button>

          {!currentNode.contactRequired && (
            <button
              onClick={() => goToNextNode()}
              className="w-full max-w-md py-3 px-6 bg-transparent text-white/60 hover:text-white/80 transition-all text-sm"
            >
              Skip
            </button>
          )}

          <div className="mt-4 text-white/40 text-xs text-center">
            Powered by{" "}
            <a
              href="https://mirourmirour.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              Mirour
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-primary to-mirour-yellow w-full" />
        </div>
      </div>
    );
  }

  // Complete Screen - triggers submission
  if (currentNode?.type === "complete") {
    // Auto-submit when reaching complete
    if (!submitting && !redemptionCode && !errorMessage) {
      console.log("API CALL: submitResponse - complete node");
      setTimeout(() => submitResponse(), 0);
    }

    return (
      <div className="fixed inset-0 bg-mirour-dark flex flex-col items-center justify-center px-6">
        {errorMessage ? (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500 text-2xl font-bold">
              !
            </div>
            <p className="text-white mb-6 max-w-sm">{errorMessage}</p>
            <button
              onClick={() => {
                setErrorMessage("");
              }}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-white animate-spin mx-auto mb-4" />
            <p className="text-white/60 text-sm">Saving your responses...</p>
          </div>
        )}
      </div>
    );
  }

  // Question Screen
  if (currentNode?.type === "question") {
    return (
      <div className="fixed inset-0 bg-mirour-dark animate-fade-in flex flex-col">
        {isOffline && (
          <div className="w-full bg-orange-500 text-white text-center py-2 px-4 shadow-sm text-sm font-medium z-50">
            You're offline. Answers are saved — we'll submit when you reconnect.
          </div>
        )}
        <div className="relative flex-1 flex flex-col items-center pt-8 pb-12 px-6 overflow-y-auto">
          {nodeHistory.length > 0 && (
            <button
              onClick={handleBack}
              className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors text-sm font-medium flex items-center gap-1 z-10"
            >
              ← Back
            </button>
          )}
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md py-8">
            <p className="text-white text-xl font-medium mb-4 text-center flex-shrink-0">
              {businessName}
            </p>

            <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
              {businessLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={businessLogo}
                  alt={businessName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">🪞</span>
              )}
            </div>

            <h2 className="text-white text-2xl text-center mb-6 px-4 leading-tight flex-shrink-0">
              {currentNode.label}
            </h2>

            <div className="w-full space-y-3 flex-shrink-0">
              {(currentNode.questionType === "multiple-choice" ||
                currentNode.questionType === "quiz") &&
                currentNode.options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-lg hover:bg-white/20 transition-all shadow-lg"
                  >
                    {option}
                  </button>
                ))}

              {currentNode.questionType === "rating" && (
                <div className="space-y-3">
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleAnswer(rating)}
                        className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-xl hover:bg-white/20 transition-all shadow-lg"
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  {(currentNode.ratingScaleLeft ||
                    currentNode.ratingScaleRight) && (
                    <div className="flex justify-between text-white/60 text-sm px-2">
                      <span>{currentNode.ratingScaleLeft || ""}</span>
                      <span>{currentNode.ratingScaleRight || ""}</span>
                    </div>
                  )}
                </div>
              )}

              {(currentNode.questionType === "short-answer" ||
                currentNode.questionType === "long-answer") && (
                <div className="space-y-3">
                  {currentNode.questionType === "long-answer" ? (
                    <textarea
                      placeholder="Type your answer..."
                      rows={4}
                      className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15 resize-none"
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [currentNode.id]: e.target.value,
                        })
                      }
                      value={answers[currentNode.id] || ""}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [currentNode.id]: e.target.value,
                        })
                      }
                      value={answers[currentNode.id] || ""}
                    />
                  )}
                  <button
                    onClick={() => {
                      const isAnswered = answers[currentNode.id]?.trim();

                      if (!isAnswered) {
                        setErrorMessage("Please answer this question first");
                        setTimeout(() => setErrorMessage(""), 2000);
                        return;
                      }

                      handleAnswer(answers[currentNode.id]);
                    }}
                    className="w-full py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
                  >
                    Next
                  </button>
                </div>
              )}

              {currentNode.questionType === "checkboxes" &&
                currentNode.options?.map((option, index) => {
                  const selected =
                    Array.isArray(answers[currentNode.id]) &&
                    answers[currentNode.id].includes(option);
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        const currentAnswers = Array.isArray(
                          answers[currentNode.id],
                        )
                          ? answers[currentNode.id]
                          : [];
                        const newAnswers = selected
                          ? currentAnswers.filter((a: string) => a !== option)
                          : [...currentAnswers, option];
                        setAnswers({
                          ...answers,
                          [currentNode.id]: newAnswers,
                        });
                      }}
                      className={`w-full py-4 px-6 backdrop-blur-md border rounded-2xl text-white text-lg transition-all shadow-lg ${
                        selected
                          ? "bg-white/30 border-white/50"
                          : "bg-white/10 border-white/20 hover:bg-white/20"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}

              {currentNode.questionType === "photo" && formId && (
                <PhotoUploadQuestion
                  questionId={currentNode.id}
                  value={answers[currentNode.id]}
                  onChange={(value) =>
                    setAnswers({ ...answers, [currentNode.id]: value })
                  }
                  onNext={() => {
                    if (!answers[currentNode.id]) {
                      setErrorMessage("Please upload a photo");
                      setTimeout(() => setErrorMessage(""), 2000);
                      return;
                    }
                    handleAnswer(answers[currentNode.id]);
                  }}
                  formId={formId}
                  sessionId={sessionIdRef.current || visitorId}
                />
              )}
            </div>

            {currentNode.questionType === "checkboxes" &&
              Array.isArray(answers[currentNode.id]) &&
              answers[currentNode.id].length > 0 && (
                <button
                  onClick={() => handleAnswer(answers[currentNode.id])}
                  className="mt-4 w-full py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
                >
                  Next
                </button>
              )}

            {errorMessage && (
              <p className="text-red-400 text-sm mt-4 animate-fade-in">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="w-full max-w-md flex-shrink-0 mt-4">
            <p className="text-white/40 text-xs text-center mb-3">
              {answeredCount + 1} of {questionNodes.length}
            </p>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-mirour-yellow transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 text-white/40 text-xs text-center">
              Powered by{" "}
              <a
                href="https://mirourmirour.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white/80 transition-colors"
              >
                Mirour
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getMatchingProducts = (node: FlowNode) => {
    if (!node.recommendationLogic || !form)
      return { products: [], allFilteredAll: false, zoneFilteredAll: false };

    // M4 In-Stock, Dedupe and Active filtering
    const dedupeSet = new Set(customerProfile?.skus_shown_all || []);
    const validStoreProducts = storeProducts
      .filter((p) => p.in_stock !== false)
      .filter((p) => !dedupeSet.has(p.id));

    console.log("🛠️ Store Products Count:", storeProducts.length);
    console.log(
      "🛠️ Valid Store Products (after In-Stock/Dedupe):",
      validStoreProducts.length,
    );

    // 1. Calculate accumulated tags from answers
    const accumulatedTagIds = calculateCollectedTags();

    // Helper: Filter a list of products by tags
    const filterProducts = (
      candidates: any[],
      useTags = true,
      strategy = "any",
    ) => {
      if (!useTags || accumulatedTagIds.length === 0) {
        return { matches: candidates, allFiltered: false };
      }

      let filtered = candidates;
      let allFiltered = false;

      // Step A: "Match All" Strategy Logic
      if (strategy === "all") {
        filtered = candidates.filter((p) => {
          const pTags = p.tags?.map((t: any) => t.id) || [];
          return accumulatedTagIds.every((tag) => pTags.includes(tag));
        });

        if (filtered.length === 0) {
          allFiltered = true;
        }
      }

      console.log(
        `🔍 Auto-Filter Stats: Candidates=${candidates.length}, Matches=${filtered.length} (Tags=${accumulatedTagIds.length}, Strategy=${strategy})`,
      );

      // If 'all' strategy eliminated everything
      if (filtered.length === 0 && strategy === "all") {
        return { matches: [], allFiltered: true };
      }

      // Step B: Tag Scoring/Filtering
      const scored = filtered.map((p) => {
        const pTags = p.tags?.map((t: any) => t.id) || [];
        let score = 0;

        accumulatedTagIds.forEach((tagId) => {
          if (pTags.includes(tagId)) {
            score += 1;
          }
        });

        return { product: p, score };
      });

      const matches = scored
        .filter((item) => {
          // If strategy is "any", must have at least one match
          if (strategy === "any") return item.score > 0;
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.product);

      return { matches, allFiltered: false };
    };

    const limit = node.recommendationLogic.limit || 6;
    const strategy = node.recommendationLogic.matchStrategy || "any";
    const zoneId = node.recommendationLogic.zoneId;
    const fallbackToStaffPicks =
      node.recommendationLogic.fallbackToStaffPicks ?? true;

    const deduplicateByName = (products: any[]) => {
      const seenNames = new Set();
      const unique = [];
      for (const p of products) {
        if (!seenNames.has(p.name)) {
          seenNames.add(p.name);
          unique.push(p);
        }
      }
      return unique;
    };

    // --- STRATEGY EXECUTION ---

    // CASE 1: Zone-First Strategy
    if (strategy === "zone-first" && zoneId) {
      // Level 1: Products from this zone + matching tags
      const zoneProducts = validStoreProducts.filter(
        (p) => p.zone_id === zoneId,
      );
      const level1 = filterProducts(zoneProducts, true, "any");

      let finalProducts = [...level1.matches];

      // Level 2: If < limit, expand to all store products + tags
      if (finalProducts.length < limit && !level1.allFiltered) {
        // Exclude already added
        const outputIds = new Set(finalProducts.map((p) => p.id));
        const otherProducts = validStoreProducts.filter(
          (p) => !outputIds.has(p.id) && p.zone_id !== zoneId, // Prefer zone first
        );
        const level2 = filterProducts(otherProducts, true, "any");
        finalProducts = [...finalProducts, ...level2.matches];
      }

      // Level 3: Failover to Staff Picks (Zone then Global)
      if (finalProducts.length < limit && fallbackToStaffPicks) {
        const outputIds = new Set(finalProducts.map((p) => p.id));

        // Zone staff picks
        const zoneStaffPicks = zoneProducts.filter(
          (p) => p.is_staff_pick && !outputIds.has(p.id),
        );
        finalProducts = [...finalProducts, ...zoneStaffPicks];

        // Global staff picks
        if (finalProducts.length < limit) {
          const globalStaffPicks = validStoreProducts.filter(
            (p) =>
              p.is_staff_pick &&
              !outputIds.has(p.id) &&
              !zoneStaffPicks.includes(p),
          );
          finalProducts = [...finalProducts, ...globalStaffPicks];
        }
      }

      console.log(
        `🏁 Zone-First Result: ${finalProducts.length} products (ZoneFiltered=${level1.matches.length === 0})`,
      );

      return {
        products: deduplicateByName(finalProducts).slice(0, limit),
        allFilteredAll: level1.allFiltered && finalProducts.length === 0,
        zoneFilteredAll:
          level1.matches.length === 0 && finalProducts.length === 0,
      };
    }

    // CASE 2: Standard Strategy ("any" or "all")
    const { matches, allFiltered } = filterProducts(
      validStoreProducts,
      true,
      strategy,
    );
    let finalProducts = [...matches];

    // Fallback: Staff Picks
    if (finalProducts.length < limit && fallbackToStaffPicks) {
      const outputIds = new Set(finalProducts.map((p) => p.id));
      const staffPicks = validStoreProducts.filter(
        (p) => p.is_staff_pick && !outputIds.has(p.id),
      );
      finalProducts = [...finalProducts, ...staffPicks];
    }

    console.log(
      `🏁 Standard Result: ${finalProducts.length} products (AllFiltered=${allFiltered})`,
    );

    return {
      products: deduplicateByName(finalProducts).slice(0, limit),
      allFilteredAll: allFiltered && finalProducts.length === 0,
      zoneFilteredAll: false,
    };
  };
  if (currentNode?.type === "product-showcase") {
    return (
      <ProductShowcaseNode
        node={currentNode}
        storeProducts={storeProducts}
        businessLogo={businessLogo}
        businessName={businessName}
        onNext={handleContinue}
      />
    );
  }
  // Recommendation Screen
  if (currentNode?.type === "recommendation") {
    const matchingProducts = getMatchingProducts(currentNode);

    return (
      <RecommendationNode
        node={{
          ...currentNode,
          header: replacePlaceholders(currentNode.header),
          content: replacePlaceholders(currentNode.content),
        }}
        products={matchingProducts.products}
        allFilteredAll={matchingProducts.allFilteredAll}
        zoneFilteredAll={matchingProducts.zoneFilteredAll}
        tags={storeTags}
        answers={answers}
        onNext={handleContinue}
        businessLogo={businessLogo}
        businessName={businessName}
        customerArchetype={customerArchetype}
        skuProfileCopy={skuProfileCopy}
        storeId={form?.store_id}
        sessionId={sessionIdRef.current || visitorId}
        customerId={customerProfile?.id}
        storeProducts={storeProducts}
        onIdentify={(id) =>
          setCustomerProfile({ ...(customerProfile || {}), id })
        }
      />
    );
  }

  // Fallback
  return (
    <div className="fixed inset-0 bg-mirour-dark flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-white animate-spin" />
    </div>
  );
}
