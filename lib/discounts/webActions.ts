"use server";

import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { getCustomerByProfileId } from "@/lib/data/customers.server";
import { validatePromo, applyDiscounts } from "./engine";
import { findPromoByCode } from "@/lib/data/promos.server";
import { discountRequestSchema } from "@/lib/validators/discounts";
import type { DiscountPreview } from "./actions";

/**
 * Aperçu de remise côté vitrine (lecture seule). La cliente n'est JAMAIS
 * désignée par le client : elle est résolue depuis la session serveur.
 * Anonyme : points ignorés, codes VIP refusés.
 */
export async function previewWebDiscount(input: {
  subtotal: number;
  promoCode?: string;
  pointsRequested: number;
}): Promise<{ ok: true; preview: DiscountPreview; customerPoints: number | null } | { ok: false; error: string }> {
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
    const session = await getSession();
    const customer =
      session && session.role === "customer" ? await getCustomerByProfileId(session.userId) : null;

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
      customerPoints: customer?.points ?? null,
    };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
