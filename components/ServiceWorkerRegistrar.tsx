"use client";

import { useEffect } from "react";
import { registerProductDeleteSW } from "@/lib/product-delete-sync";

/**
 * Registers the product-delete service worker once on app mount.
 * Renders nothing — purely a side-effect component.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerProductDeleteSW();
  }, []);

  return null;
}
