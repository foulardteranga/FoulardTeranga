export interface StoreCartLine {
  key: string;
  productId: string;
  name: string;
  variant: string;
  colorHex: string;
  price: number;
  qty: number;
  /** Photo principale du produit au moment de l'ajout (miniatures panier/checkout). */
  image?: string;
}

export function cartKey(productId: string, variant: string): string {
  return `${productId}|${variant}`;
}

export function addLine(
  cart: StoreCartLine[],
  line: Omit<StoreCartLine, "qty" | "key"> & { qty?: number }
): StoreCartLine[] {
  const key = cartKey(line.productId, line.variant);
  const qty = line.qty ?? 1;
  const existing = cart.find((l) => l.key === key);
  if (existing) {
    return cart.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
  }
  return [...cart, { ...line, key, qty }];
}

export function incLine(cart: StoreCartLine[], key: string, delta: number): StoreCartLine[] {
  return cart
    .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
    .filter((l) => l.qty > 0);
}

export function removeLine(cart: StoreCartLine[], key: string): StoreCartLine[] {
  return cart.filter((l) => l.key !== key);
}

export function cartSubtotal(cart: StoreCartLine[]): number {
  return cart.reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function cartCount(cart: StoreCartLine[]): number {
  return cart.reduce((sum, l) => sum + l.qty, 0);
}
