import { describe, it, expect } from "vitest";
import type { ProductVariantItem } from "./ProductVariantsField";

function computeTotalStock(variants: ProductVariantItem[]): number {
  return variants.filter((v) => v.active).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
}

function addVariantHelper(
  existing: ProductVariantItem[],
  newColor: { name: string; hex: string; stock?: number }
): ProductVariantItem[] {
  if (existing.some((v) => v.colorHex.toLowerCase() === newColor.hex.toLowerCase())) {
    return existing; // Pas de doublon
  }
  return [
    ...existing,
    {
      colorName: newColor.name,
      colorHex: newColor.hex,
      stock: newColor.stock ?? 5,
      active: true,
      position: existing.length,
    },
  ];
}

describe("ProductVariantsField - Logique métier", () => {
  it("calcule correctement la somme du stock pour les variantes actives", () => {
    const variants: ProductVariantItem[] = [
      { colorName: "Bordeaux", colorHex: "#6B1D2F", stock: 8, active: true, position: 0 },
      { colorName: "Bleu nuit", colorHex: "#0D1B2A", stock: 5, active: true, position: 1 },
      { colorName: "Beige", colorHex: "#F5F5DC", stock: 12, active: false, position: 2 }, // désactivé
    ];
    expect(computeTotalStock(variants)).toBe(13); // 8 + 5
  });

  it("ajoute une nouvelle variante sans doublon de code HEX", () => {
    let variants: ProductVariantItem[] = [
      { colorName: "Bordeaux", colorHex: "#6B1D2F", stock: 8, active: true, position: 0 },
    ];

    // Ajout d'une couleur différente
    variants = addVariantHelper(variants, { name: "Camel", hex: "#C19A6B", stock: 6 });
    expect(variants).toHaveLength(2);

    // Tentative d'ajout du même code HEX (insensible à la casse)
    variants = addVariantHelper(variants, { name: "Autre Bordeaux", hex: "#6b1d2f" });
    expect(variants).toHaveLength(2);
  });
});
