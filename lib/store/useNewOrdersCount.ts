import { useShop } from "./useShop";

/** Nombre de commandes encore « à valider », en tenant compte des surcharges. */
export function useNewOrdersCount(): number {
  return useShop((s) => s.pendingCount());
}
