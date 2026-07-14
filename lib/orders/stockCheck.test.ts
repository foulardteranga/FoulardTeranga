import { describe, it, expect } from "vitest";
import { aggregateQtyByProduct } from "@/lib/orders/stockCheck";

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
