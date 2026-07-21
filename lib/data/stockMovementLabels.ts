import type { StockMovementReason } from "@/lib/generated/prisma/client";

/** Libellés FR affichés dans le journal des mouvements de stock. */
export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  vente_pos: "Vente boutique",
  vente_web: "Vente en ligne",
  reception: "Entrée atelier / Réception",
  perte: "Perte ou casse",
  correction: "Correction d'inventaire",
};
