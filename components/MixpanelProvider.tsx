"use client";

import { useEffect } from "react";
import { initMixpanel } from "@/lib/mixpanel";
import { usePathname } from "next/navigation";

export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Only initialize if we are not in the /f/ routes
    if (pathname && !pathname.startsWith("/f/")) {
      initMixpanel();
    }
  }, [pathname]);

  return <>{children}</>;
}
