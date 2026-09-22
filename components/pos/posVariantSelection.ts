import type { Product } from "@/lib/data/types";

/**
 * Détermine si le modal tactile de sélection de variante doit s'ouvrir lors d'un clic
 * sur une vignette produit en caisse POS.
 * Retourne true si le produit dispose d'au moins 2 variantes actives.
 */
export function shouldOpenVariantPicker(product: Product): boolean {
  if (!product.variants || product.variants.length < 2) return false;
  const activeVariants = product.variants.filter((v) => v.active);
  return activeVariants.length >= 2;
}
