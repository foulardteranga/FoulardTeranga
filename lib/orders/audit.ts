import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderAuditAction } from "@/lib/generated/prisma/enums";
import type { Role } from "@/lib/auth/session";

export interface OrderAuditEntry {
  tenantId: string;
  orderRef: string;
  action: OrderAuditAction;
  actorId: string;
  actorRole: Role;
  stockReconciled: boolean;
  reason?: string | null;
  orderSnapshot: unknown;
}

/**
 * Écrit une entrée du journal d'archivage/suppression des commandes. Toujours
 * appelé avec le client de transaction (`tx`) : "fait" et "tracé" doivent
 * rester le même événement atomique (miroir de recordPlatformAction).
 */
export async function recordOrderAuditLog(
  entry: OrderAuditEntry,
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.orderAuditLog.create({
    data: {
      tenantId: entry.tenantId,
      orderRef: entry.orderRef,
      action: entry.action,
      reason: entry.reason ?? null,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      stockReconciled: entry.stockReconciled,
      // Retire les objets Date (non JSON-natifs) avant écriture dans la colonne Json.
      orderSnapshot: JSON.parse(JSON.stringify(entry.orderSnapshot)) as Prisma.InputJsonValue,
    },
  });
}
