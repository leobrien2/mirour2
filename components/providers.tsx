"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { StoresProvider } from "@/hooks/useStores";
import { FormsProvider } from "@/hooks/useForms";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useState } from "react";

import { ThemeProvider } from "next-themes";
import { MixpanelProvider } from "@/components/MixpanelProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <MixpanelProvider>
          <AuthProvider>
            <StoresProvider>
              <FormsProvider>
                <TooltipProvider>
                  {children}
                  <Toaster />
                  <Sonner />
                </TooltipProvider>
              </FormsProvider>
            </StoresProvider>
          </AuthProvider>
        </MixpanelProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
