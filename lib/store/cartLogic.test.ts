import { describe, it, expect } from "vitest";
import { cartKey, addLine, incLine, removeLine, cartSubtotal, cartCount } from "@/lib/store/cartLogic";
import type { StoreCartLine } from "@/lib/store/cartLogic";

const scarf = { productId: "p1", name: "Foulard Wax Abidjan", variant: "Indigo", colorHex: "#26326B", price: 12500 };

describe("cartKey", () => {
  it("combines productId and variant", () => {
    expect(cartKey("p1", "Indigo")).toBe("p1|Indigo");
  });
});

describe("addLine", () => {
  it("adds a new line with qty 1 by default", () => {
    const cart = addLine([], scarf);
    expect(cart).toEqual([{ ...scarf, key: "p1|Indigo", qty: 1 }]);
  });

  it("merges quantity when the same product+variant is added again", () => {
    let cart: StoreCartLine[] = [];
    cart = addLine(cart, scarf);
    cart = addLine(cart, scarf);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it("keeps separate lines for different variants of the same product", () => {
    let cart: StoreCartLine[] = [];
    cart = addLine(cart, scarf);
    cart = addLine(cart, { ...scarf, variant: "Terracotta", colorHex: "#D07A34" });
    expect(cart).toHaveLength(2);
  });

  it("accepts an explicit qty", () => {
    const cart = addLine([], { ...scarf, qty: 3 });
    expect(cart[0].qty).toBe(3);
  });
});

describe("incLine", () => {
  it("increments the matching line", () => {
    const cart = addLine([], scarf);
    const result = incLine(cart, "p1|Indigo", 1);
    expect(result[0].qty).toBe(2);
  });

  it("removes the line once qty reaches zero", () => {
    const cart = addLine([], scarf);
    const result = incLine(cart, "p1|Indigo", -1);
    expect(result).toHaveLength(0);
  });
});

describe("removeLine", () => {
  it("removes the line by key", () => {
    const cart = addLine([], scarf);
    expect(removeLine(cart, "p1|Indigo")).toHaveLength(0);
  });
});

describe("cartSubtotal / cartCount", () => {
  it("sums price*qty and total quantity across lines", () => {
    let cart: StoreCartLine[] = [];
    cart = addLine(cart, { ...scarf, qty: 2 });
    cart = addLine(cart, { productId: "p9", name: "Broche dorée", variant: "Standard", colorHex: "#C9A227", price: 4500, qty: 1 });
    expect(cartSubtotal(cart)).toBe(29500);
    expect(cartCount(cart)).toBe(3);
  });
});
