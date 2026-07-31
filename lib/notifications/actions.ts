"use server";

import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";

export async function markNotificationRead(
  id: string
): Promise<{ ok: true } | { ok: false; error?: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const tenant = await getCurrentTenant();
  await prisma.notification.updateMany({
    where: { id, tenantId: tenant.id },
    data: { read: true },
  });
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: true } | { ok: false; error?: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const tenant = await getCurrentTenant();
  await prisma.notification.updateMany({
    where: { tenantId: tenant.id, read: false },
    data: { read: true },
  });
  return { ok: true };
}
