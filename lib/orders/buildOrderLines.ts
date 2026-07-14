export interface WebCartLineInput {
  productId: string;
  qty: number;
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
  lineTotal: number;
}

/**
 * Construit les lignes de commande et le total à partir de prix serveur —
 * jamais du prix envoyé par le client. `products` doit contenir un prix
 * actuel par `productId` (lu depuis Postgres par l'appelant).
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
    lines.push({
      productId: product.id,
      nameAtOrder: product.name,
      qty: line.qty,
      unitPrice: product.price,
      lineTotal: product.price * line.qty,
    });
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { ok: true, lines, total };
}
