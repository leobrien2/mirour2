"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  ArrowRight,
  AlertTriangle,
  BookmarkPlus,
  Check,
} from "lucide-react";
import { FEATURES } from "@/lib/features";

export default function ZonePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const zoneId = params?.zoneId as string;
  const location = searchParams?.get("location");

  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState<any>(null);
  const [zoneConfig, setZoneConfig] = useState<any>(null);
  const [zoneProducts, setZoneProducts] = useState<any[]>([]);

  const [profile, setProfile] = useState<any>(null);
  const [savedStatus, setSavedStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const fetchZoneData = async () => {
    if (!zoneId) return;

    try {
      const [zoneRes, configRes, productsRes] = await Promise.all([
        (supabase as any).from("zones").select("*").eq("id", zoneId).single(),
        location
          ? (supabase as any)
              .from("zone_store_config")
              .select("*")
              .eq("zone_id", zoneId)
              .eq("location_id", location)
              .single()
          : Promise.resolve({ data: null, error: null }),
        (supabase as any)
          .from("products")
          .select("*")
          .eq("zone_id", zoneId)
          .eq("in_stock", true)
          .eq("active", true),
      ]);

      if (zoneRes.data) setZone(zoneRes.data);
      if (configRes.data && !configRes.error) setZoneConfig(configRes.data);
      if (productsRes.data) setZoneProducts(productsRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUserProfile = async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("mirour_token");
    if (!token) {
      setProfile(null);
      return;
    }

    try {
      const res = await fetch(`/api/customers/lookup?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error("Profile fetch error", e);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchZoneData(), fetchUserProfile()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mirour_token") {
        fetchUserProfile();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [zoneId, location]);

  const handleSaveZone = async () => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("mirour_token")
        : null;
    if (!token) {
      // Need a profile to save
      if (typeof window !== "undefined") {
        sessionStorage.setItem("return_to_zone", zoneId);
      }
      router.push(`/start${location ? `?location=${location}` : ""}`);
      return;
    }

    setSavedStatus("saving");
    try {
      const res = await fetch("/api/customers/zones/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ zone_id: zoneId }),
      });
      if (res.ok) {
        setSavedStatus("saved");
      } else {
        setSavedStatus("error");
      }
    } catch (e) {
      setSavedStatus("error");
    }
  };

  const handleFindProfile = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("return_to_zone", zoneId);
    }
    router.push(`/start${location ? `?location=${location}` : ""}`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-mirour-dark flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="fixed inset-0 bg-mirour-dark flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-white text-2xl font-semibold mb-2">
          Zone Not Found
        </h1>
        <p className="text-white/60">
          This zone doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  const isPersonalized = profile && FEATURES.ZONE_PERSONALIZATION;
  const isTHCFree =
    profile?.tags?.map((t: string) => t.toLowerCase()).includes("thc-free") ||
    false;
  const showTHCWarning = zoneId === "thc-options" && isTHCFree;

  return (
    <div className="min-h-screen bg-mirour-dark overflow-y-auto">
      <div className="max-w-md mx-auto relative pt-8 pb-24 px-6">
        {showTHCWarning && (
          <div className="bg-orange-500/20 border border-orange-500/50 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="text-orange-500 w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-orange-200 text-sm">
              Your profile is set to THC-free. The products in this zone contain
              THC.
            </p>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-3">{zone.name}</h1>
          <p className="text-white/80 leading-relaxed">
            {zoneConfig?.location_description ||
              zone.description ||
              `Welcome to ${zone.name}. Explore our curated selection.`}
          </p>
        </div>

        {isPersonalized ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 border border-primary/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <span className="text-6xl">✨</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">
              Welcome back, {profile.name || "Friend"}!
            </h2>
            <p className="text-white/70 text-sm mb-4">
              Based on your profile, here's what we recommend in this zone.
            </p>
            {/* Just an example of personalized content block */}
            <div className="h-1 w-12 bg-primary rounded-full mb-2"></div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/10 text-center">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">🪞</span>
            </div>
            <h2 className="text-white font-medium mb-1">
              Get Personalized Recommendations
            </h2>
            <p className="text-white/60 text-sm mb-4">
              Enter your number to see products matched to your taste.
            </p>
            <button
              onClick={handleFindProfile}
              className="w-full py-3 bg-white text-mirour-dark font-medium rounded-xl hover:bg-white/90 transition-colors"
            >
              Find My Profile
            </button>
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-white text-lg font-medium mb-4 flex items-center justify-between">
            Products in this Zone
            <span className="text-white/40 text-sm">{zoneProducts.length}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {zoneProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white/5 rounded-xl border border-white/10 p-2 flex flex-col"
              >
                <div className="aspect-[3/4] bg-white/5 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl opacity-20">📦</span>
                  )}
                </div>
                <h4 className="text-white text-sm font-medium leading-tight mb-1">
                  {product.name}
                </h4>
                {product.price && (
                  <p className="text-white/70 text-xs font-mono">
                    ${product.price}
                  </p>
                )}
              </div>
            ))}

            {zoneProducts.length === 0 && (
              <div className="col-span-2 text-center py-8 px-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white/60 text-sm">
                  No products currently available in this zone.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-6 left-0 right-0 px-6">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleSaveZone}
              disabled={savedStatus === "saving" || savedStatus === "saved"}
              className={`w-full py-4 px-6 rounded-2xl font-medium transition-all shadow-lg flex items-center justify-center gap-2 ${
                savedStatus === "saved"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white/30"
              }`}
            >
              {savedStatus === "saving" && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              {savedStatus === "saved" && <Check className="w-5 h-5" />}
              {savedStatus === "idle" && <BookmarkPlus className="w-5 h-5" />}
              {savedStatus === "error" && "Error Saving"}

              {savedStatus === "saved"
                ? "Zone Saved"
                : profile
                  ? "Save This Zone"
                  : "Save for Next Time"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
