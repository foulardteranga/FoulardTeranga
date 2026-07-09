import { catalog } from "@/lib/data/catalog";
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
export function computeEffectiveStock(productId: string, deductions: Record<string, number>): number {
  const product = catalog.find((p) => p.id === productId);
  if (!product) return 0;
  const deducted = deductions[productId] ?? 0;
  return Math.max(0, product.stock - deducted);
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
