// components/flow/FloatingProfileBar.tsx
"use client";

import { Bookmark, User, ChevronUp } from "lucide-react";
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

  return (
    <button
      onClick={onClick}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-full bg-background/95 backdrop-blur-md border border-border shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-200 active:scale-[0.97] max-w-xs w-auto"
    >
      {/* Left: user/identity indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            isLoggedIn
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground/50"
          }`}
        >
          <User className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          {isLoggedIn ? `Hi, ${displayName}` : "Your profile"}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-border/60" />

      {/* Right: saved items count */}
      {/* <div className="flex items-center gap-1.5">
        <Bookmark
          className={`w-3.5 h-3.5 transition-colors ${
            savedCount > 0
              ? "text-primary fill-primary/20"
              : "text-muted-foreground/40"
          }`}
        />
        <span
          className={`text-xs font-bold ${
            savedCount > 0 ? "text-primary" : "text-muted-foreground/50"
          }`}
        >
          {savedCount > 0 ? savedCount : "0"} saved
        </span>
      </div> */}

      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40 ml-1" />
    </button>
  );
}
