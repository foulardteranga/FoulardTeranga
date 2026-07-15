import { prisma } from "@/lib/db/client";
import type { NotificationType } from "@/lib/generated/prisma/client";

/** Crée une notification back-office. Appelé depuis les Server Actions métier (commandes, stock) — jamais directement par le client. */
export async function createNotification(params: {
  tenantId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
}): Promise<void> {
  await prisma.notification.create({ data: params });
}
