"use client";

import { useEffect } from "react";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";

/**
 * Both `useShop` and `useStorefront` use `persist({ skipHydration: true })` so
 * the server-rendered markup never depends on localStorage. This component
 * triggers the one-time client rehydration after mount, per Zustand's
 * documented SSR pattern.
 */
export function HydrateStores() {
  useEffect(() => {
    useShop.persist.rehydrate();
    useStorefront.persist.rehydrate();
  }, []);

  return null;
}
