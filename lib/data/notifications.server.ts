import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { NotificationType } from "@/lib/generated/prisma/client";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

const LIMIT = 20;

/** Lit les dernières notifications du tenant courant, les plus récentes d'abord. */
export async function getNotifications(): Promise<NotificationItem[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.notification.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}
