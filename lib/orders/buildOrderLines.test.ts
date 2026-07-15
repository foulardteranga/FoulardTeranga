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
      { productId: "p1", nameAtOrder: "Foulard Wax Abidjan", qty: 2, unitPrice: 12500, discount: 0, lineTotal: 25000 },
      { productId: "p9", nameAtOrder: "Broche dorée", qty: 1, unitPrice: 4500, discount: 0, lineTotal: 4500 },
    ]);
    expect(result.total).toBe(29500);
  });

  it("applies a 10% discount to a line marked discounted, recomputed from the server price", () => {
    const result = buildOrderLines([{ productId: "p1", qty: 2, discounted: true }], PRODUCTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 12500 * 0.1 = 1250 discount per unit → (12500 - 1250) * 2 = 22500
    expect(result.lines).toEqual([
      { productId: "p1", nameAtOrder: "Foulard Wax Abidjan", qty: 2, unitPrice: 12500, discount: 1250, lineTotal: 22500 },
    ]);
    expect(result.total).toBe(22500);
  });

  it("keeps discount at 0 for a line explicitly marked not discounted", () => {
    const result = buildOrderLines([{ productId: "p1", qty: 1, discounted: false }], PRODUCTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0].discount).toBe(0);
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
