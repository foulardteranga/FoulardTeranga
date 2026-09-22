export interface StockCheckLine {
  productId: string;
  variantId?: string | null;
  qty: number;
  nameAtOrder: string;
  variantName?: string | null;
}

/**
 * Agrège la quantité demandée par produit à partir des lignes d'une commande.
 *
 * Nécessaire car les lignes de panier sont clées par `(productId, variant)`
 * (longueurs ou couleurs différentes d'un même foulard, par ex.) : une commande peut donc
 * contenir plusieurs `OrderLine` partageant le même `productId`. Vérifier le
 * stock ligne par ligne contre le stock courant (non encore décrémenté)
 * laisserait passer une commande où la somme des quantités dépasse le stock
 * réel — d'où l'agrégation par produit avant toute vérification.
 */
export function aggregateQtyByProduct(
  lines: StockCheckLine[]
): Map<string, { qty: number; nameAtOrder: string }> {
  const byProduct = new Map<string, { qty: number; nameAtOrder: string }>();
  for (const line of lines) {
    const existing = byProduct.get(line.productId);
    if (existing) {
      existing.qty += line.qty;
    } else {
      byProduct.set(line.productId, { qty: line.qty, nameAtOrder: line.nameAtOrder });
    }
  }
  return byProduct;
}

/**
 * Agrège la quantité demandée par variante spécifique (couleur) à partir des lignes de commande.
 * Ignore les lignes ne ciblant aucune variante spécifique.
 */
export function aggregateQtyByVariant(
  lines: StockCheckLine[]
): Map<string, { productId: string; qty: number; nameAtOrder: string; variantName?: string | null }> {
  const byVariant = new Map<
    string,
    { productId: string; qty: number; nameAtOrder: string; variantName?: string | null }
  >();
  for (const line of lines) {
    if (!line.variantId) continue;
    const existing = byVariant.get(line.variantId);
    if (existing) {
      existing.qty += line.qty;
    } else {
      byVariant.set(line.variantId, {
        productId: line.productId,
        qty: line.qty,
        nameAtOrder: line.nameAtOrder,
        variantName: line.variantName,
      });
    }
  }
  return byVariant;
}
