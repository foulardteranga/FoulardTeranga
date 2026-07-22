"use client";

import { useEffect, useState } from "react";

/**
 * Détecte un pointeur « grossier » (tactile) via matchMedia. Faux par défaut
 * (SSR/premier rendu, comme tout hook basé sur matchMedia dans ce projet —
 * cf. VitrineEditor.handleCanvasClick), se met à jour après montage.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    setCoarse(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return coarse;
}
