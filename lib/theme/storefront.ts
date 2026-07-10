/** Dégradé de vignette produit à partir d'une couleur de marque (mock, sans image). */
export function stripe(hex: string): string {
  return `repeating-linear-gradient(45deg, ${hex}22, ${hex}22 11px, #efe8dc 11px, #efe8dc 22px)`;
}

/** Fond de badge produit : noir pour les distinctions "★", terracotta sinon. */
export function badgeBackground(badge: string): string {
  return badge.includes("★") ? "#1E1B18" : "#D07A34";
}
