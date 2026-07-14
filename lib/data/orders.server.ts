import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { fmt, money } from "@/lib/format";
import { formatOrderAgo, formatOrderDate } from "./orderStatus";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Order } from "./types";

type PrismaOrderWithLines = Prisma.OrderGetPayload<{ include: { lines: true } }>;

/** Convertit une commande Prisma (+ lignes) vers le type applicatif `Order`. */
function toOrder(row: PrismaOrderWithLines): Order {
  const items = row.lines.reduce((sum, l) => sum + l.qty, 0);
  return {
    id: row.ref,
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
  };
}

/** Lit toutes les commandes du tenant courant, les plus récentes d'abord. */
export async function getOrders(): Promise<Order[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.order.findMany({
    where: { tenantId: tenant.id },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toOrder);
}

/** Lit une commande par sa référence affichée (« #TER-XXXX »). `null` si absente. */
export async function getOrderByRef(ref: string): Promise<Order | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.order.findFirst({
    where: { ref, tenantId: tenant.id },
    include: { lines: true },
  });
  return row ? toOrder(row) : null;
}

/** Nombre de commandes encore « à valider » (statut `nouvelle`). */
export async function getPendingOrdersCount(): Promise<number> {
  const tenant = await getCurrentTenant();
  return prisma.order.count({ where: { tenantId: tenant.id, status: "nouvelle" } });
}
