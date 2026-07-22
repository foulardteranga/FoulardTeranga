export interface WebCartLineInput {
  productId: string;
  qty: number;
  /** Remise POS de 10% appliquée à cette ligne — absent/false pour une commande web. */
  discounted?: boolean;
}

export interface PriceLookup {
  id: string;
  name: string;
  price: number;
}

export interface OrderLineData {
  productId: string;
  nameAtOrder: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

/** Taux de remise POS fixe (bouton "Ajouter remise -10%" du panier caisse). */
export const POS_DISCOUNT_RATE = 0.1;

/**
 * Construit les lignes de commande et le total à partir de prix serveur —
 * jamais du prix envoyé par le client. `products` doit contenir un prix
 * actuel par `productId` (lu depuis Postgres par l'appelant). La remise
 * (le cas échéant) est elle aussi recalculée ici à partir du prix serveur,
 * jamais reçue en FCFA depuis le client.
 */
export function buildOrderLines(
  cartLines: WebCartLineInput[],
  products: PriceLookup[]
): { ok: true; lines: OrderLineData[]; total: number } | { ok: false; error: string } {
  if (cartLines.length === 0) {
    return { ok: false, error: "Le panier est vide." };
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: OrderLineData[] = [];
  for (const line of cartLines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return { ok: false, error: "Quantité invalide." };
    }
    const product = byId.get(line.productId);
    if (!product) {
      return { ok: false, error: `Produit introuvable : ${line.productId}` };
    }
    const discount = line.discounted ? Math.round(product.price * POS_DISCOUNT_RATE) : 0;
    lines.push({
      productId: product.id,
      nameAtOrder: product.name,
      qty: line.qty,
      unitPrice: product.price,
      discount,
      lineTotal: (product.price - discount) * line.qty,
    });
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { ok: true, lines, total };
}
