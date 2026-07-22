import { POINT_VALUE_FCFA } from "@/lib/customers/loyalty";
import { money } from "@/lib/format";

export interface PromoRule {
  kind: "percent" | "amount";
  value: number;
  minTotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  vipOnly: boolean;
  active: boolean;
}

/** Valide un code contre son contexte d'usage. Raisons en FR, affichées telles quelles. */
export function validatePromo(
  promo: PromoRule | null,
  ctx: { now: Date; subtotal: number; isVip: boolean }
): { ok: true } | { ok: false; reason: string } {
  if (!promo || !promo.active) return { ok: false, reason: "Code inconnu ou inactif" };
  if (promo.startsAt && ctx.now < promo.startsAt) return { ok: false, reason: "Code pas encore actif" };
  if (promo.endsAt && ctx.now > promo.endsAt) return { ok: false, reason: "Code expiré" };
  if (promo.minTotal !== null && ctx.subtotal < promo.minTotal) {
    return { ok: false, reason: `Achat minimum de ${money(promo.minTotal)} non atteint` };
  }
  if (promo.vipOnly && !ctx.isVip) return { ok: false, reason: "Réservé aux clientes VIP" };
  return { ok: true };
}

/**
 * Cumul des remises : promo d'abord, points ensuite sur le restant.
 * Les points sont plafonnés au solde ET au restant (total jamais négatif,
 * aucun point converti au-delà du montant à payer).
 */
export function applyDiscounts(input: {
  subtotal: number;
  promo?: PromoRule | null;
  pointsRequested: number;
  pointsBalance: number;
}): { promoDiscount: number; pointsUsed: number; pointsDiscount: number; total: number } {
  const promoDiscount = !input.promo
    ? 0
    : input.promo.kind === "percent"
      ? Math.round((input.subtotal * input.promo.value) / 100)
      : Math.min(input.promo.value, input.subtotal);
  const remaining = input.subtotal - promoDiscount;
  const pointsUsed = Math.min(
    Math.max(0, Math.floor(input.pointsRequested)),
    Math.max(0, input.pointsBalance),
    Math.floor(remaining / POINT_VALUE_FCFA)
  );
  const pointsDiscount = pointsUsed * POINT_VALUE_FCFA;
  return { promoDiscount, pointsUsed, pointsDiscount, total: remaining - pointsDiscount };
}
