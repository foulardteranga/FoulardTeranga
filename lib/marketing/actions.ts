"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { promoCreateSchema, type PromoCreateInput } from "@/lib/validators/promo";

/** Fin de journée locale pour une date AAAA-MM-JJ (un code « jusqu'au 24/07 » vaut toute la journée du 24). */
function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`);
}

export async function createPromoCode(
  input: PromoCreateInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = promoCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();
    const existing = await prisma.promoCode.findFirst({
      where: { tenantId: tenant.id, code: parsed.data.code },
    });
    if (existing) return { ok: false, error: "Ce code existe déjà." };

    await prisma.promoCode.create({
      data: {
        tenantId: tenant.id,
        code: parsed.data.code,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minTotal: parsed.data.minTotal ?? null,
        startsAt: parsed.data.startsAt ? new Date(`${parsed.data.startsAt}T00:00:00`) : null,
        endsAt: parsed.data.endsAt ? endOfDay(parsed.data.endsAt) : null,
        vipOnly: parsed.data.vipOnly,
      },
    });
    revalidatePath("/marketing");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function setPromoCodeActive(
  id: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    const promo = await prisma.promoCode.findFirst({ where: { id, tenantId: tenant.id } });
    if (!promo) return { ok: false, error: "Code introuvable." };
    await prisma.promoCode.update({ where: { id: promo.id }, data: { active } });
    revalidatePath("/marketing");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
