import { describe, expect, it } from "vitest";
import { discountRequestSchema } from "./discounts";

describe("discountRequestSchema", () => {
  it("defaults and sanitizes points", () => {
    expect(discountRequestSchema.parse({}).pointsRequested).toBe(0);
    expect(discountRequestSchema.parse({ pointsRequested: 12 }).pointsRequested).toBe(12);
    expect(discountRequestSchema.parse({ pointsRequested: Number.NaN }).pointsRequested).toBe(0);
    expect(
      discountRequestSchema.safeParse({ pointsRequested: -3 }).success
        ? discountRequestSchema.parse({ pointsRequested: -3 }).pointsRequested
        : 0
    ).toBe(0);
  });
  it("trims the promo code", () => {
    expect(discountRequestSchema.parse({ promoCode: " teranga10 " }).promoCode).toBe("teranga10");
  });
});
