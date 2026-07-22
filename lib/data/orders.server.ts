import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { fmt, money } from "@/lib/format";
import { formatOrderAgo, formatOrderDate } from "./orderStatus";
import { validatePromo } from "@/lib/discounts/engine";
import type { Prisma, PromoCode } from "@/lib/generated/prisma/client";
import type { Order, OrderStatus } from "./types";

type PrismaOrderWithLines = Prisma.OrderGetPayload<{ include: { lines: true } }>;

export interface OrderStatusEventView {
  status: OrderStatus;
  date: string;
  authorName: string | null;
}

/** Convertit une commande Prisma (+ lignes) vers le type applicatif `Order`. */
function toOrder(row: PrismaOrderWithLines, promoValidity: Map<string, boolean>): Order {
  const items = row.lines.reduce((sum, l) => sum + l.qty, 0);
  return {
    id: row.ref,
    trackingToken: row.id,
    cid: row.customerId ?? "web",
    client: row.clientName,
    place: row.place,
    phone: row.phone,
    items,
    channel: row.channel,
    ago: formatOrderAgo(row.createdAt),
    date: formatOrderDate(row.createdAt),
    total: money(row.total),
    status: row.status,
    vip: row.vipAtOrder,
    lines: row.lines.map((l) => ({
      name: l.nameAtOrder,
      qty: l.qty,
      price: fmt(l.unitPrice),
      total: fmt(l.lineTotal),
      productId: l.productId,
    })),
    subtotal: money(row.lines.reduce((s, l) => s + l.lineTotal, 0)),
    promoCode: row.promoCode,
    promoDiscount: row.promoDiscount,
    pointsUsed: row.pointsUsed,
    pointsDiscount: row.pointsDiscount,
    promoStillValid: promoValidity.get(row.id) ?? true,
  };
}

/**
 * Pour chaque commande `nouvelle` avec un `promoCode`, vérifie si le code passe
 * toujours (actif/période/minimum). `isVip: true` volontairement : le vrai
 * statut VIP n'est connu qu'à la validation, on ne signale ici que les
 * invalidités sûres (indépendantes de la cliente).
 */
async function buildPromoValidityMap(
  tenantId: string,
  rows: PrismaOrderWithLines[]
): Promise<Map<string, boolean>> {
  const pending = rows.filter((r) => r.status === "nouvelle" && r.promoCode);
  const map = new Map<string, boolean>();
  if (pending.length === 0) return map;

  const codes = await prisma.promoCode.findMany({ where: { tenantId } });
  const byCode = new Map<string, PromoCode>(codes.map((c) => [c.code, c]));
  const now = new Date();
  for (const row of pending) {
    const subtotal = row.lines.reduce((s, l) => s + l.lineTotal, 0);
    const promo = row.promoCode ? (byCode.get(row.promoCode) ?? null) : null;
    const verdict = validatePromo(promo, { now, subtotal, isVip: true });
    map.set(row.id, verdict.ok);
  }
  return map;
}

/** Lit toutes les commandes du tenant courant, les plus récentes d'abord. */
export async function getOrders(): Promise<Order[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.order.findMany({
    where: { tenantId: tenant.id },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  const promoValidity = await buildPromoValidityMap(tenant.id, rows);
  return rows.map((row) => toOrder(row, promoValidity));
}

/** Lit une commande par son jeton de suivi (cuid interne, non devinable) — seul
 *  identifiant utilisable pour un accès public (suivi client sans compte). */
export async function getOrderByTrackingToken(token: string): Promise<Order | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.order.findFirst({
    where: { id: token, tenantId: tenant.id },
    include: { lines: true },
  });
  if (!row) return null;
  const promoValidity = await buildPromoValidityMap(tenant.id, [row]);
  return toOrder(row, promoValidity);
}

/** Historique des changements de statut d'une commande, du plus ancien au plus récent. */
export async function getOrderStatusHistory(ref: string): Promise<OrderStatusEventView[]> {
  const tenant = await getCurrentTenant();
  const order = await prisma.order.findFirst({ where: { ref, tenantId: tenant.id } });
  if (!order) return [];
  const now = new Date();
  const rows = await prisma.orderStatusEvent.findMany({
    where: { orderId: order.id, tenantId: tenant.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    status: r.status,
    date: formatOrderDate(r.createdAt, now),
    authorName: r.author?.name ?? null,
  }));
}

/** Nombre de commandes encore « à valider » (statut `nouvelle`). */
export async function getPendingOrdersCount(): Promise<number> {
  const tenant = await getCurrentTenant();
  return prisma.order.count({ where: { tenantId: tenant.id, status: "nouvelle" } });
}
