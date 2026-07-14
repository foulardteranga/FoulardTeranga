import { describe, it, expect } from "vitest";
import { buildOrderLines } from "@/lib/orders/buildOrderLines";

const PRODUCTS = [
  { id: "p1", name: "Foulard Wax Abidjan", price: 12500 },
  { id: "p9", name: "Broche dorée", price: 4500 },
];

describe("buildOrderLines", () => {
  it("builds lines and a total from server-side prices, ignoring any client price", () => {
    const result = buildOrderLines(
      [{ productId: "p1", qty: 2 }, { productId: "p9", qty: 1 }],
      PRODUCTS
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([
      { productId: "p1", nameAtOrder: "Foulard Wax Abidjan", qty: 2, unitPrice: 12500, lineTotal: 25000 },
      { productId: "p9", nameAtOrder: "Broche dorée", qty: 1, unitPrice: 4500, lineTotal: 4500 },
    ]);
    expect(result.total).toBe(29500);
  });

  it("fails cleanly if a cart line references an unknown product", () => {
    const result = buildOrderLines([{ productId: "nope", qty: 1 }], PRODUCTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("nope");
  });

  it("fails cleanly on a zero or negative quantity", () => {
    const result = buildOrderLines([{ productId: "p1", qty: 0 }], PRODUCTS);
    expect(result.ok).toBe(false);
  });

  it("fails cleanly on an empty cart", () => {
    const result = buildOrderLines([], PRODUCTS);
    expect(result.ok).toBe(false);
  });
});
