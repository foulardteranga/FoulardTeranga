/** 1 point acquis par tranche de 1 000 FCFA dépensé (constante métier, non éditable en v1). */
export const POINTS_PER_FCFA_UNIT = 1000;
/** Seuil de points à partir duquel une cliente passe VIP (constante métier, non éditable en v1). */
export const VIP_THRESHOLD_POINTS = 150;

export type CustomerLoyaltySegment = "VIP" | "Fidele" | "Nouvelle";

export interface LoyaltyResult {
  points: number;
  vip: boolean;
  segment: CustomerLoyaltySegment;
}

/**
 * Calcule points/statut VIP/segment à partir du total dépensé et du nombre de
 * commandes confirmées cumulés. Une fois VIP (points ne décroissent jamais en
 * v1), le segment ne redescend jamais vers Nouvelle/Fidele.
 */
export function computeLoyalty(totalSpent: number, ordersCount: number): LoyaltyResult {
  const points = Math.floor(totalSpent / POINTS_PER_FCFA_UNIT);
  const vip = points >= VIP_THRESHOLD_POINTS;
  const segment: CustomerLoyaltySegment = vip ? "VIP" : ordersCount === 1 ? "Nouvelle" : "Fidele";
  return { points, vip, segment };
}
