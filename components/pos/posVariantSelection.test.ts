import { describe, it, expect } from "vitest";
import { shouldOpenVariantPicker } from "./posVariantSelection";
import type { Product } from "@/lib/data/types";

describe("shouldOpenVariantPicker", () => {
  it("ouvre le modal si le produit a 2 variantes actives ou plus", () => {
    const product = {
      id: "p1",
      variants: [
        { id: "v1", colorName: "Bordeaux", colorHex: "#6B1D2F", stock: 5, active: true },
        { id: "v2", colorName: "Bleu nuit", colorHex: "#0D1B2A", stock: 3, active: true },
      ],
    } as unknown as Product;
    expect(shouldOpenVariantPicker(product)).toBe(true);
  });

  it("n'ouvre pas le modal si le produit a 0 ou 1 seule variante active", () => {
    const p1 = {
      id: "p2",
      variants: [{ id: "v1", colorName: "Unique", colorHex: "#6B1D2F", stock: 5, active: true }],
    } as unknown as Product;
    expect(shouldOpenVariantPicker(p1)).toBe(false);

    const p2 = {
      id: "p3",
      variants: [
        { id: "v1", colorName: "Bordeaux", colorHex: "#6B1D2F", stock: 5, active: true },
        { id: "v2", colorName: "Inactif", colorHex: "#000000", stock: 0, active: false },
      ],
    } as unknown as Product;
    expect(shouldOpenVariantPicker(p2)).toBe(false);

    const pEmpty = { id: "p4", variants: [] } as unknown as Product;
    expect(shouldOpenVariantPicker(pEmpty)).toBe(false);
  });
});
