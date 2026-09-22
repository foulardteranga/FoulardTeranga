import { describe, it, expect } from "vitest";

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
  const colors = (product.colors && product.colors.length > 0)
    ? product.colors
    : [product.swatch || "#1E1B18"];

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

  // Si plusieurs couleurs existaient déjà dans le tableau colors[], on répartit le stock ou on met le stock principal sur la première
  return colors.map((hex, i) => ({
    productId: product.id,
    colorName: `Couleur ${i + 1}`,
    colorHex: hex,
    stock: i === 0 ? stock : 0,
    active: true,
    position: i,
  }));
}

describe("buildDefaultVariantsForProduct", () => {
  it("génère une variante par défaut pour un produit mono-couleur", () => {
    const prod: LegacyProductForMigration = {
      id: "p1",
      name: "Foulard Soie",
      swatch: "#6B1D2F",
      colors: ["#6B1D2F"],
      stock: 10,
    };
    const variants = buildDefaultVariantsForProduct(prod);
    expect(variants).toHaveLength(1);
    expect(variants[0].productId).toBe("p1");
    expect(variants[0].colorHex).toBe("#6B1D2F");
    expect(variants[0].stock).toBe(10);
    expect(variants[0].active).toBe(true);
  });

  it("génère les variantes pour un produit ayant plusieurs couleurs avec stock initial sur la première", () => {
    const prod: LegacyProductForMigration = {
      id: "p2",
      name: "Foulard Teranga Duo",
      swatch: "#26326B",
      colors: ["#26326B", "#D07A34"],
      stock: 15,
    };
    const variants = buildDefaultVariantsForProduct(prod);
    expect(variants).toHaveLength(2);
    expect(variants[0].colorHex).toBe("#26326B");
    expect(variants[0].stock).toBe(15);
    expect(variants[1].colorHex).toBe("#D07A34");
    expect(variants[1].stock).toBe(0);
  });
});
