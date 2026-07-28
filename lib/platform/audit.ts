import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PlatformAction } from "@/lib/generated/prisma/enums";

/** Client Prisma ordinaire ou client de transaction — l'audit doit pouvoir vivre dans les deux. */
export type PlatformDb = typeof prisma | Prisma.TransactionClient;

export interface PlatformAuditEntry {
  /** Toujours le vrai super_admin, jamais une identité empruntée (spec §1.3). */
  actorId: string;
  action: PlatformAction;
  tenantId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Écrit une entrée du journal prestataire. Passer `db` permet d'inscrire la
 * trace dans la même transaction que l'action tracée : « fait » et « tracé »
 * deviennent alors le même événement.
 */
export async function recordPlatformAction(
  entry: PlatformAuditEntry,
  db: PlatformDb = prisma
): Promise<void> {
  await db.platformAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      tenantId: entry.tenantId ?? null,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
