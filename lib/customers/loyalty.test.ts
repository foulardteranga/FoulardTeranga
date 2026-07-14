import { describe, it, expect } from "vitest";
import { computeLoyalty, POINTS_PER_FCFA_UNIT, VIP_THRESHOLD_POINTS } from "@/lib/customers/loyalty";

describe("computeLoyalty", () => {
  it("computes one point per 1 000 FCFA spent, rounded down", () => {
    const result = computeLoyalty(54500, 3);
    expect(result.points).toBe(54);
  });

  it("marks a customer VIP once points reach the threshold", () => {
    const result = computeLoyalty(VIP_THRESHOLD_POINTS * POINTS_PER_FCFA_UNIT, 5);
    expect(result.vip).toBe(true);
    expect(result.segment).toBe("VIP");
  });

  it("stays non-VIP just under the threshold", () => {
    const result = computeLoyalty(VIP_THRESHOLD_POINTS * POINTS_PER_FCFA_UNIT - 1000, 5);
    expect(result.vip).toBe(false);
  });

  it("segments a first-time customer as Nouvelle", () => {
    const result = computeLoyalty(12500, 1);
    expect(result.segment).toBe("Nouvelle");
  });

  it("segments a repeat non-VIP customer as Fidele", () => {
    const result = computeLoyalty(50000, 2);
    expect(result.segment).toBe("Fidele");
  });

  it("labels a VIP customer as VIP even on their first order, never Nouvelle", () => {
    const result = computeLoyalty(200000, 1);
    expect(result.vip).toBe(true);
    expect(result.segment).toBe("VIP");
  });
});
