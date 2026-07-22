import { describe, it, expect } from "vitest";
import {
  computeLoyaltyStatus,
  pointsEarnedFor,
  POINT_VALUE_FCFA,
  VIP_THRESHOLD_SPENT_FCFA,
} from "@/lib/customers/loyalty";

describe("pointsEarnedFor", () => {
  it("credits one point per 1 000 FCFA paid, rounded down", () => {
    expect(pointsEarnedFor(54500)).toBe(54);
    expect(pointsEarnedFor(999)).toBe(0);
  });

  it("never returns a negative credit", () => {
    expect(pointsEarnedFor(0)).toBe(0);
  });
});

describe("computeLoyaltyStatus", () => {
  it("marks a customer VIP once lifetime spend reaches the threshold", () => {
    const result = computeLoyaltyStatus(VIP_THRESHOLD_SPENT_FCFA, 5);
    expect(result.vip).toBe(true);
    expect(result.segment).toBe("VIP");
  });

  it("stays non-VIP just under the threshold", () => {
    expect(computeLoyaltyStatus(VIP_THRESHOLD_SPENT_FCFA - 1000, 5).vip).toBe(false);
  });

  it("segments a first-time customer as Nouvelle", () => {
    expect(computeLoyaltyStatus(12500, 1).segment).toBe("Nouvelle");
  });

  it("segments a repeat non-VIP customer as Fidele", () => {
    expect(computeLoyaltyStatus(50000, 2).segment).toBe("Fidele");
  });

  it("labels a VIP customer VIP even on their first order", () => {
    expect(computeLoyaltyStatus(200000, 1).segment).toBe("VIP");
  });
});

describe("constants", () => {
  it("one point is worth 50 FCFA when redeemed", () => {
    expect(POINT_VALUE_FCFA).toBe(50);
  });
});
