"use server";

import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { validatePromo, applyDiscounts } from "./engine";
import { findPromoByCode } from "@/lib/data/promos.server";
import { discountRequestSchema } from "@/lib/validators/discounts";

export interface DiscountPreview {
  promo: { code: string; discount: number } | null;
  promoError: string | null;
  pointsUsed: number;
  pointsDiscount: number;
  total: number;
  subtotal: number;
}

/** Aperçu de remise pour le POS (lecture seule — aucun débit, aucun compteur). */
export async function previewPosDiscount(input: {
  subtotal: number;
  promoCode?: string;
  pointsRequested: number;
  customerId?: string | null;
}): Promise<{ ok: true; preview: DiscountPreview } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  if (!Number.isFinite(input.subtotal) || input.subtotal < 0) {
    return { ok: false, error: "Montant invalide." };
  }
  const parsedDiscounts = discountRequestSchema.safeParse({
    promoCode: input.promoCode,
    pointsRequested: input.pointsRequested,
  });
  const safeDiscounts = parsedDiscounts.success ? parsedDiscounts.data : { pointsRequested: 0 };

  try {
    const tenant = await getCurrentTenant();
    const customer = input.customerId
      ? await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: tenant.id } })
      : null;

    let promoRow = null;
    let promoError: string | null = null;
    if (safeDiscounts.promoCode?.trim()) {
      promoRow = await findPromoByCode(prisma, tenant.id, safeDiscounts.promoCode);
      const verdict = validatePromo(promoRow, {
        now: new Date(),
        subtotal: input.subtotal,
        isVip: customer?.vip ?? false,
      });
      if (!verdict.ok) {
        promoError = verdict.reason;
        promoRow = null;
      }
    }

    const d = applyDiscounts({
      subtotal: input.subtotal,
      promo: promoRow,
      pointsRequested: customer ? Math.max(0, Math.floor(safeDiscounts.pointsRequested ?? 0)) : 0,
      pointsBalance: customer?.points ?? 0,
    });
    return {
      ok: true,
      preview: {
        promo: promoRow && d.promoDiscount > 0 ? { code: promoRow.code, discount: d.promoDiscount } : null,
        promoError,
        pointsUsed: d.pointsUsed,
        pointsDiscount: d.pointsDiscount,
        total: d.total,
        subtotal: input.subtotal,
      },
    };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
