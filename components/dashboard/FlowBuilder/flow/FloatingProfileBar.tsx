// components/flow/FloatingProfileBar.tsx
"use client";

import { User, LogIn } from "lucide-react";
import type { LocalCustomerProfile } from "@/lib/customerSession";

interface FloatingProfileBarProps {
  onClick: () => void;
  savedCount: number;
  customer: LocalCustomerProfile | null;
}

export function FloatingProfileBar({
  onClick,
  savedCount,
  customer,
}: FloatingProfileBarProps) {
  const isLoggedIn = !!customer;
  const displayName = customer?.firstname ?? customer?.name?.split(" ")[0];

  // ── Not logged in → compact "Login" pill ─────────────────────────────────
  if (!isLoggedIn) {
    return (
      <button
        onClick={onClick}
        className="fixed top-4 right-4 z-30 flex items-center gap-1.5 px-4 py-2 rounded-full
          bg-background/95 backdrop-blur-md border border-border shadow-md
          hover:shadow-lg hover:border-primary/30 transition-all duration-200 active:scale-[0.97]"
      >
        <LogIn className="w-3.5 h-3.5 text-muted-foreground/60" />
        <span className="text-sm font-semibold text-foreground/80">Login</span>
      </button>
    );
  }

  // ── Logged in → name + saved count badge ─────────────────────────────────
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full
        bg-background/95 backdrop-blur-md border border-border shadow-md
        hover:shadow-lg hover:border-primary/30 transition-all duration-200 active:scale-[0.97]"
    >
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="w-3 h-3 text-primary" />
      </div>
      <span className="text-sm font-semibold text-foreground max-w-[80px] truncate">
        {displayName}
      </span>
      {savedCount > 0 && (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0 leading-none">
          {savedCount > 9 ? "9+" : savedCount}
        </span>
      )}
    </button>
  );
}
