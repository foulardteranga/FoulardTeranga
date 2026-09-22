import { describe, it, expect } from "vitest";
import { aggregateQtyByProduct, aggregateQtyByVariant } from "@/lib/orders/stockCheck";

describe("aggregateQtyByProduct", () => {
  it("sums quantities for order lines that share the same productId (different variants/lengths)", () => {
    const result = aggregateQtyByProduct([
      { productId: "p1", qty: 3, nameAtOrder: "Foulard Wax Abidjan" },
      { productId: "p1", qty: 3, nameAtOrder: "Foulard Wax Abidjan" },
    ]);
    expect(result.get("p1")).toEqual({ qty: 6, nameAtOrder: "Foulard Wax Abidjan" });
  });

  it("keeps distinct products separate", () => {
    const result = aggregateQtyByProduct([
      { productId: "p1", qty: 2, nameAtOrder: "Foulard Wax Abidjan" },
      { productId: "p9", qty: 1, nameAtOrder: "Broche dorée" },
    ]);
    expect(result.get("p1")).toEqual({ qty: 2, nameAtOrder: "Foulard Wax Abidjan" });
    expect(result.get("p9")).toEqual({ qty: 1, nameAtOrder: "Broche dorée" });
  });

  it("returns an empty map for no lines", () => {
    const result = aggregateQtyByProduct([]);
    expect(result.size).toBe(0);
  });
});

describe("aggregateQtyByVariant", () => {
  it("agrège les quantités par variantId", () => {
    const lines = [
      { productId: "p1", variantId: "v1", qty: 2, nameAtOrder: "Foulard Bordeaux", variantName: "Bordeaux" },
      { productId: "p1", variantId: "v1", qty: 3, nameAtOrder: "Foulard Bordeaux", variantName: "Bordeaux" },
      { productId: "p1", variantId: "v2", qty: 1, nameAtOrder: "Foulard Bleu", variantName: "Bleu nuit" },
    ];
    const map = aggregateQtyByVariant(lines);
    expect(map.get("v1")?.qty).toBe(5);
    expect(map.get("v1")?.variantName).toBe("Bordeaux");
    expect(map.get("v2")?.qty).toBe(1);
    expect(map.get("v2")?.variantName).toBe("Bleu nuit");
  });

  it("ignore les lignes sans variantId", () => {
    const lines = [
      { productId: "p1", qty: 2, nameAtOrder: "Foulard sans variante" },
      { productId: "p2", variantId: "v3", qty: 4, nameAtOrder: "Foulard Vert" },
    ];
    const map = aggregateQtyByVariant(lines);
    expect(map.size).toBe(1);
    expect(map.get("v3")?.qty).toBe(4);
  });
});
