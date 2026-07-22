/** 1 point gagné par tranche de 1 000 FCFA réellement payés (constante métier, non éditable en v1). */
export const POINTS_PER_FCFA_UNIT = 1000;
/** Valeur d'un point à l'utilisation : 50 FCFA de remise (constante métier, non éditable en v1). */
export const POINT_VALUE_FCFA = 50;
/**
 * Seuil VIP : 150 000 FCFA dépensés à vie — équivalent exact de l'ancien seuil
 * « 150 points » du temps où les points étaient dérivés de totalSpent. Le statut
 * VIP est découplé du solde : dépenser ses points ne le fait jamais perdre.
 */
export const VIP_THRESHOLD_SPENT_FCFA = 150_000;

export type CustomerLoyaltySegment = "VIP" | "Fidele" | "Nouvelle";

/** Points crédités par une vente, sur le montant réellement payé. */
export function pointsEarnedFor(paidTotal: number): number {
  return Math.max(0, Math.floor(paidTotal / POINTS_PER_FCFA_UNIT));
}

/** Statut VIP + segment, dérivés du cumul dépensé à vie (jamais du solde de points). */
export function computeLoyaltyStatus(
  totalSpent: number,
  ordersCount: number
): { vip: boolean; segment: CustomerLoyaltySegment } {
  const vip = totalSpent >= VIP_THRESHOLD_SPENT_FCFA;
  const segment: CustomerLoyaltySegment = vip ? "VIP" : ordersCount === 1 ? "Nouvelle" : "Fidele";
  return { vip, segment };
}
