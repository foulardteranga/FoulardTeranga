import { describe, it, expect } from "vitest";
import {
  computeEffectiveStatus,
  countPending,
  computeEffectiveStock,
  buildWebOrder,
  applyConfirmDeductions,
} from "@/lib/store/shopLogic";
import { orders } from "@/lib/data/orders";
import type { Order } from "@/lib/data/types";

describe("computeEffectiveStatus", () => {
  it("returns the order's own status with no override", () => {
    const order = orders.find((o) => o.id === "#TER-0492")!;
    expect(computeEffectiveStatus(order, {})).toBe("nouvelle");
  });

  it("returns the override when present", () => {
    const order = orders.find((o) => o.id === "#TER-0492")!;
    expect(computeEffectiveStatus(order, { [order.id]: "confirmee" })).toBe("confirmee");
  });
});

describe("countPending", () => {
  it("counts only orders whose effective status is nouvelle", () => {
    // seed data: #TER-0492, #TER-0491, #TER-0490 are "nouvelle"; the rest are not.
    expect(countPending(orders, {})).toBe(3);
  });

  it("respects overrides when counting", () => {
    expect(countPending(orders, { "#TER-0492": "confirmee" })).toBe(2);
  });
});

describe("computeEffectiveStock", () => {
  it("returns the base stock with no deduction", () => {
    expect(computeEffectiveStock("p1", {})).toBe(24);
  });

  it("subtracts a recorded deduction", () => {
    expect(computeEffectiveStock("p1", { p1: 10 })).toBe(14);
  });

  it("clamps at zero if the deduction exceeds stock", () => {
    expect(computeEffectiveStock("p1", { p1: 999 })).toBe(0);
  });

  it("returns 0 for an unknown product id", () => {
    expect(computeEffectiveStock("nope", {})).toBe(0);
  });
});

describe("buildWebOrder", () => {
  const kyc = { name: "Awa Diallo", place: "Paris, France", phone: "+33 6 12 34 56 78", note: "", wa: true };
  const cartLines = [
    { productId: "p1", name: "Foulard Wax Abidjan", variant: "Indigo", price: 12500, qty: 2 },
    { productId: "p9", name: "Broche dorée", variant: "Standard", price: 4500, qty: 1 },
  ];

  it("builds a pending Web order with a recomputed total", () => {
    const order = buildWebOrder(kyc, cartLines, "#TER-2701");
    expect(order.id).toBe("#TER-2701");
    expect(order.status).toBe("nouvelle");
    expect(order.channel).toBe("Web");
    expect(order.items).toBe(3);
    // Normalise l'espace (fmt() produit une espace fine insécable U+202F) avant comparaison.
    expect(order.total.replace(/\s/g, " ")).toBe("29 500 FCFA"); // 2*12500 + 1*4500 = 29500
  });

  it("carries the customer's own place/phone verbatim (no hardcoded country)", () => {
    const order = buildWebOrder(kyc, cartLines, "#TER-2702");
    expect(order.place).toBe("Paris, France");
    expect(order.phone).toBe("+33 6 12 34 56 78");
  });

  it("carries productId on every line for later stock deduction", () => {
    const order = buildWebOrder(kyc, cartLines, "#TER-2703");
    expect(order.lines.map((l) => l.productId)).toEqual(["p1", "p9"]);
  });
});

describe("applyConfirmDeductions", () => {
  const order: Order = {
    id: "#TER-9001", cid: "web", client: "Test", place: "Test", phone: "000",
    items: 3, channel: "Web", ago: "", date: "", total: "0 FCFA", status: "nouvelle", vip: false,
    lines: [
      { name: "A", qty: 2, price: "0", total: "0", productId: "p1" },
      { name: "B", qty: 1, price: "0", total: "0", productId: "p9" },
    ],
  };

  it("adds line quantities to the deduction map", () => {
    const result = applyConfirmDeductions({}, order);
    expect(result).toEqual({ p1: 2, p9: 1 });
  });

  it("accumulates on top of an existing deduction for the same product", () => {
    const result = applyConfirmDeductions({ p1: 5 }, order);
    expect(result.p1).toBe(7);
  });

  it("does not mutate other products' deductions", () => {
    const result = applyConfirmDeductions({ p3: 4 }, order);
    expect(result.p3).toBe(4);
  });
});
