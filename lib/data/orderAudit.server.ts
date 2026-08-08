import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { formatOrderDate } from "./orderStatus";
import type { OrderAuditAction } from "@/lib/generated/prisma/enums";

export interface OrderAuditLogEntry {
  id: string;
  orderRef: string;
  action: OrderAuditAction;
  reason: string | null;
  actorName: string;
  date: string;
}

/**
 * Journal complet des archivages/restaurations/suppressions du tenant
 * courant, le plus récent d'abord. Réservé à owner : le garde applicatif vit
 * dans la page appelante (`app/(dashboard)/journal-audit/page.tsx`), la RLS
 * (`order_audit_log_select_owner`) est la garde de défense en profondeur.
 * `actorId` n'a pas de FK (miroir PlatformAuditLog) : jointure manuelle par
 * lot plutôt qu'un `include` Prisma.
 */
export async function getOrderAuditLog(): Promise<OrderAuditLogEntry[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.orderAuditLog.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actorId))];
  const authors = await prisma.profile.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.name]));
  const now = new Date();

  return rows.map((r) => ({
    id: r.id,
    orderRef: r.orderRef,
    action: r.action,
    reason: r.reason,
    actorName: nameById.get(r.actorId) ?? "Compte supprimé",
    date: formatOrderDate(r.createdAt, now),
  }));
}
