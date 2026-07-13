import type { Order, OrderStatus } from "./types";

/** Statut effectif = surcharge locale (validation/refus) sinon statut d'origine. */
export function effStatus(
  o: Order,
  overrides: Record<string, OrderStatus>
): OrderStatus {
  return overrides[o.id] ?? o.status;
}

/** Métadonnées d'affichage (badge) par statut de commande. */
export const statusMeta: Record<
  OrderStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  nouvelle: { label: "À valider", bg: "#FBF1D8", color: "#8a6500", dot: "#E0A400" },
  confirmee: { label: "Confirmée", bg: "#EEF0F7", color: "#26326B", dot: "#26326B" },
  preparation: { label: "En préparation", bg: "#FBF1D8", color: "#8a6500", dot: "#E0A400" },
  livree: { label: "Livrée", bg: "#E6F4EE", color: "#0b6e4d", dot: "#0E9F6E" },
  refusee: { label: "Refusée", bg: "#F8E5E3", color: "#9c352d", dot: "#C4453B" },
};
