"use client";

import { useEffect } from "react";
import { useStorefront } from "@/lib/store/useStorefront";

/**
 * `useStorefront` uses `persist({ skipHydration: true })` so the
 * server-rendered markup never depends on localStorage. This component
 * triggers the one-time client rehydration after mount, per Zustand's
 * documented SSR pattern.
 */
export function HydrateStores() {
  useEffect(() => {
    useStorefront.persist.rehydrate();
  }, []);

  return null;
}
