import { orders } from "@/lib/data/orders";
import { effStatus } from "@/lib/data/orderStatus";
import { useBackoffice } from "./useBackoffice";

/** Nombre de commandes encore « à valider », en tenant compte des surcharges. */
export function useNewOrdersCount(): number {
  const overrides = useBackoffice((s) => s.orderStatus);
  return orders.filter((o) => effStatus(o, overrides) === "nouvelle").length;
}
