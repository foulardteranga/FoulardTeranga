import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { money } from "@/lib/format";
import { formatOrderDate } from "./orderStatus";
import type { Customer as PrismaCustomer } from "@/lib/generated/prisma/client";
import type { Customer, CustomerOrderHistoryEntry, CustomerSegment } from "./types";

const SEGMENT_LABELS: Record<PrismaCustomer["segment"], CustomerSegment> = {
  VIP: "VIP",
  Fidele: "Fidèle",
  Nouvelle: "Nouvelle",
};

/** Convertit une fiche Prisma vers le type applicatif `Customer` (segment accentué, montant formaté). */
export function toCustomer(row: PrismaCustomer): Customer {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    phone: row.phone,
    place: row.place,
    points: row.points,
    orders: row.ordersCount,
    spent: money(row.totalSpent),
    vip: row.vip,
    seg: SEGMENT_LABELS[row.segment],
  };
}

/** Lit toutes les fiches clientes du tenant courant. */
export async function getCustomers(): Promise<Customer[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toCustomer);
}

/** Lit la fiche cliente liée à une session connectée (rattachement fait à l'inscription). */
export async function getCustomerByProfileId(profileId: string): Promise<Customer | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.customer.findFirst({ where: { profileId, tenantId: tenant.id } });
  return row ? toCustomer(row) : null;
}

/** Lit les commandes confirmées d'une cliente, les plus récentes d'abord. */
export async function getCustomerOrderHistory(customerId: string): Promise<CustomerOrderHistoryEntry[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.order.findMany({
    where: { customerId, tenantId: tenant.id, status: "confirmee" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((o) => ({ ref: o.ref, date: formatOrderDate(o.createdAt), total: money(o.total) }));
}
