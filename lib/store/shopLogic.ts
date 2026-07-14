import { fmt, money } from "@/lib/format";
import type { Order, OrderLine, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";

export interface WebCartLine {
  productId: string;
  name: string;
  variant: string;
  price: number;
  qty: number;
}

/** Statut effectif = surcharge locale (validation/refus) sinon statut d'origine. */
export function computeEffectiveStatus(order: Order, overrides: Record<string, OrderStatus>): OrderStatus {
  return overrides[order.id] ?? order.status;
}

export function countPending(orders: Order[], overrides: Record<string, OrderStatus>): number {
  return orders.filter((o) => computeEffectiveStatus(o, overrides) === "nouvelle").length;
}

/** Stock effectif = stock de base moins les déductions déjà appliquées (jamais négatif). */
export function computeEffectiveStock(productId: string, baseStock: number, deductions: Record<string, number>): number {
  const deducted = deductions[productId] ?? 0;
  return Math.max(0, baseStock - deducted);
}

/** Construit une commande Web en attente. Le total est recalculé ici — jamais reçu du client. */
export function buildWebOrder(kyc: KycInput, cartLines: WebCartLine[], ref: string): Order {
  const subtotal = cartLines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const itemCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const lines: OrderLine[] = cartLines.map((l) => ({
    name: l.name,
    qty: l.qty,
    price: fmt(l.price),
    total: fmt(l.price * l.qty),
    productId: l.productId,
  }));

  return {
    id: ref,
    cid: "web",
    client: kyc.name,
    place: kyc.place,
    phone: kyc.phone,
    items: itemCount,
    channel: "Web",
    ago: "à l'instant",
    date: "Aujourd'hui",
    total: money(subtotal),
    status: "nouvelle",
    vip: false,
    lines,
  };
}

/** Ajoute les quantités d'une commande confirmée aux déductions de stock existantes. */
export function applyConfirmDeductions(
  deductions: Record<string, number>,
  order: Order
): Record<string, number> {
  const next = { ...deductions };
  for (const line of order.lines) {
    next[line.productId] = (next[line.productId] ?? 0) + line.qty;
  }
  return next;
}

/** Applique la déduction de stock d'une commande une seule fois : idempotent par id
 * de commande, quelles que soient les transitions de statut ultérieures. */
export function applyConfirmOnce(
  deductions: Record<string, number>,
  deductedOrderIds: string[],
  order: Order
): { stockDeductions: Record<string, number>; deductedOrderIds: string[] } {
  if (deductedOrderIds.includes(order.id)) {
    return { stockDeductions: deductions, deductedOrderIds };
  }
  return {
    stockDeductions: applyConfirmDeductions(deductions, order),
    deductedOrderIds: [...deductedOrderIds, order.id],
  };
}
