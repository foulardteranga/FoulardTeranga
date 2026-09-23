export interface LegacyProductForMigration {
  id: string;
  name: string;
  swatch: string;
  colors: string[];
  stock: number;
}

export interface GeneratedVariant {
  productId: string;
  colorName: string;
  colorHex: string;
  stock: number;
  active: boolean;
  position: number;
}

export function buildDefaultVariantsForProduct(product: LegacyProductForMigration): GeneratedVariant[] {
  const stock = Math.max(0, product.stock || 0);
  const colors = product.colors && product.colors.length > 0 ? product.colors : [product.swatch || "#1E1B18"];

  if (colors.length <= 1) {
    return [
      {
        productId: product.id,
        colorName: "Couleur unique",
        colorHex: colors[0] || "#1E1B18",
        stock,
        active: true,
        position: 0,
      },
    ];
  }

  // Si plusieurs couleurs existaient déjà dans le tableau colors[], le stock principal est conservé sur la première
  return colors.map((hex, i) => ({
    productId: product.id,
    colorName: `Couleur ${i + 1}`,
    colorHex: hex,
    stock: i === 0 ? stock : 0,
    active: true,
    position: i,
  }));
}
