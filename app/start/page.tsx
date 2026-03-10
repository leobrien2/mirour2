"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function StartFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location");
  const formId = searchParams.get("form");

  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [isFetchingBusiness, setIsFetchingBusiness] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<{
    business_name: string;
    business_logo: string | null;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [phoneInput, setPhoneInput] = useState("");
  const [showPhoneForm, setShowPhoneForm] = useState(false);

  const isPageLoading = isCheckingToken || isFetchingBusiness || isRedirecting;

  useEffect(() => {
    const fetchBusinessConfig = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (formId) queryParams.append("formId", formId);
        if (locationId) queryParams.append("locationId", locationId);

        console.log("queryParams", queryParams.toString());

        if (!formId && !locationId) {
          setIsFetchingBusiness(false);
          return;
        }

        const res = await fetch(
          `/api/business/profile?${queryParams.toString()}`,
        );
        if (!res.ok) throw new Error("Failed to fetch business profile");

        const data = await res.json();
        if (data.success) {
          if (data.show_start_page === false) {
            setIsRedirecting(true);
            router.push(
              `/f/${formId || "default"}?location=${locationId || ""}&started=true`,
            );
            return;
          }

          if (data.profile) {
            console.log("data", data);
            setBusinessProfile(data.profile);
          }
        }
      } catch (e) {
        console.error("Failed to load business profile:", e);
      }
      setIsFetchingBusiness(false);
    };

    fetchBusinessConfig();
  }, [formId, locationId]);

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem("mirour_token");

      if (!token) {
        setIsCheckingToken(false);
        return;
      }

      try {
        const fetchProfile = async () => {
          const res = await fetch("/api/customers/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (!res.ok) throw new Error("Not found");
          return res.json();
        };

        const result: any = await Promise.race([
          fetchProfile(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 3000),
          ),
        ]);

        if (result.success) {
          setProfile(result.profile);
          // Log returning visit
          if (locationId) {
            fetch("/api/customers/visit", {
              method: "POST",
              body: JSON.stringify({
                customer_id: result.profile.id,
                location_id: locationId,
              }),
            });
          }
          handleReturnRedirection();
        } else {
          throw new Error("Invalid profile");
        }
      } catch (err) {
        localStorage.removeItem("mirour_token");
        setErrorMessage(
          "Taking longer than usual — enter your number instead.",
        );
        setIsCheckingToken(false);
      }
    };

    checkToken();
  }, [locationId]);

  const handleReturnRedirection = () => {
    const returnZone = sessionStorage.getItem("return_to_zone");
    if (returnZone) {
      sessionStorage.removeItem("return_to_zone");
      router.push(
        `/zone/${returnZone}${locationId ? `?location=${locationId}` : ""}`,
      );
    } else {
      setIsCheckingToken(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPhone(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/customers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();

      console.log("data", data);

      if (data.success) {
        localStorage.setItem("mirour_token", data.token);
        setProfile(data.profile);

        if (locationId) {
          fetch("/api/customers/visit", {
            method: "POST",
            body: JSON.stringify({
              customer_id: data.profile.id,
              location_id: locationId,
            }),
          });
        }

        handleReturnRedirection();
      } else {
        // Direct new users to the default form for this location.
        // Assuming location links to a specific form or we pass location params to /f/default
        router.push(
          `/f/${formId || "default"}?location=${locationId || ""}&started=true`,
        );
      }
    } catch (err) {
      setErrorMessage("An error occurred. Please try again.");
      setIsSubmittingPhone(false);
    }
  };

  const content = profile ? (
    <div className="flex flex-col items-center justify-center p-8 min-h-screen bg-mirour-dark font-sans animate-fade-in relative overflow-hidden">
      {/* Decorative elements */}
      {/* <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <span className="text-9xl">✨</span>
        </div> */}
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
        {businessProfile?.business_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={businessProfile.business_logo}
            alt={businessProfile.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl">🪞</span>
        )}
      </div>

      <h1 className="text-4xl font-bold mb-4 tracking-tight text-white text-center">
        Welcome Back
        <br />
        <span className="text-primary">
          {profile.name ? profile.name.split(" ")[0] : "Friend"}!
        </span>
      </h1>
      <p className="text-white/60 text-lg mb-10 max-w-sm text-center leading-relaxed">
        Quick check: What are you looking for today?
      </p>

      <div className="w-full max-w-xs flex flex-col gap-4 relative z-10">
        {["Something New", "My Usual"].map((intent) => (
          <button
            key={intent}
            onClick={() => {
              router.push(
                `/f/${formId || "default"}?location=${locationId || ""}&intent=${encodeURIComponent(intent)}`,
              );
            }}
            className="w-full py-4 px-6 text-white bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl font-medium shadow-lg hover:bg-white/20 active:scale-[0.98] transition-all text-lg flex items-center justify-between group"
          >
            {intent}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
              →
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() =>
          router.push(
            `/f/${formId || "default"}?location=${locationId || ""}&started=true`,
          )
        }
        className="mt-8 text-white/40 font-medium underline-offset-4 hover:underline hover:text-white/80 transition-all text-sm pb-8 relative z-10"
      >
        Skip, just browse
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center p-8 min-h-screen bg-mirour-dark font-sans animate-fade-in relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-[100px] pointer-events-none"></div>

      {businessProfile?.business_logo ? (
        <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8 border-2 border-primary/20 bg-card overflow-hidden shadow-xl relative z-10 transition-transform hover:scale-105 duration-300">
          <img
            src={businessProfile.business_logo}
            alt={businessProfile.business_name || "Business Logo"}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-20 h-20 bg-white/5 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-8 border border-white/10 relative z-10">
          <span className="text-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50">
            {businessProfile?.business_name
              ? businessProfile.business_name.charAt(0).toUpperCase()
              : "S"}
          </span>
        </div>
      )}

      <h1 className="text-4xl font-bold mb-4 text-center tracking-tight text-white relative z-10">
        {businessProfile?.business_name ? (
          <>
            Welcome to{" "}
            <span className="text-primary">
              {businessProfile.business_name}
            </span>
          </>
        ) : (
          "Hello there"
        )}
      </h1>
      <p className="text-white/60 text-lg mb-12 max-w-sm text-center leading-relaxed relative z-10">
        Let us know how you'd like to get started today.
      </p>

      {errorMessage && (
        <div className="bg-red-500/20 text-red-200 px-4 py-4 rounded-xl w-full max-w-xs mb-8 text-sm text-center font-medium border border-red-500/30 relative z-10 backdrop-blur-md">
          {errorMessage}
        </div>
      )}

      {!showPhoneForm ? (
        <div className="w-full max-w-xs flex flex-col gap-4 relative z-10">
          <button
            onClick={() => setShowPhoneForm(true)}
            className="w-full py-4 px-6 bg-white text-mirour-dark rounded-2xl font-semibold shadow-lg shadow-white/10 hover:bg-white/90 active:scale-[0.98] transition-all text-lg flex items-center justify-center gap-3"
          >
            I've been here before
          </button>

          <button
            onClick={() =>
              router.push(
                `/f/${formId || "default"}?location=${locationId || ""}&started=true`,
              )
            }
            className="w-full py-4 px-6 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl font-semibold shadow-sm hover:bg-white/20 hover:border-white/30 active:scale-[0.98] transition-all text-lg"
          >
            Just browsing
          </button>
        </div>
      ) : (
        <form
          onSubmit={handlePhoneSubmit}
          className="w-full max-w-xs flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-300 relative z-10"
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-white/80 pl-1">
              Enter your number
            </span>
            <button
              type="button"
              onClick={() => setShowPhoneForm(false)}
              className="text-sm text-white/40 hover:text-white/80 transition-colors pr-1"
            >
              Back
            </button>
          </div>
          <input
            type="tel"
            placeholder="Phone Number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-lg text-white placeholder:text-white/30 font-medium tracking-wide"
            required
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-4 mt-2 bg-primary text-primary-foreground rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all text-lg flex items-center justify-center"
            disabled={isSubmittingPhone}
          >
            {isSubmittingPhone ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-white" />
            ) : (
              "Continue"
            )}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-mirour-dark transition-opacity duration-700 ease-in-out pointer-events-none ${
          isPageLoading ? "opacity-100" : "opacity-0"
        }`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
      {content}
    </>
  );
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-screen items-center justify-center bg-mirour-dark">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <StartFlow />
    </Suspense>
  );
}
