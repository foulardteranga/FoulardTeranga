import { describe, expect, it } from "vitest";
import { stockAdjustmentSchema } from "./stockMovement";

describe("stockAdjustmentSchema", () => {
  it("accepte un écart positif ou négatif avec une raison manuelle valide", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 12, reason: "reception" }).success).toBe(true);
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: -3, reason: "perte" }).success).toBe(true);
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: -1, reason: "correction" }).success).toBe(true);
  });

  it("refuse un écart nul", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 0, reason: "correction" }).success).toBe(false);
  });

  it("refuse un delta non entier", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 1.5, reason: "correction" }).success).toBe(false);
  });

  it("refuse les raisons automatiques (non sélectionnables manuellement)", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 5, reason: "vente_pos" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 5, reason: "vente_web" }).success).toBe(false);
  });

  it("accepte une note optionnelle et la borne à 200 caractères", () => {
    expect(
      stockAdjustmentSchema.safeParse({ productId: "p1", delta: 1, reason: "correction", note: "Comptage physique" }).success
    ).toBe(true);
    expect(
      stockAdjustmentSchema.safeParse({ productId: "p1", delta: 1, reason: "correction", note: "x".repeat(201) }).success
    ).toBe(false);
  });

  it("refuse un productId vide", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "", delta: 1, reason: "correction" }).success).toBe(false);
  });
});
