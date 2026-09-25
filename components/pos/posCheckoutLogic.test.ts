import { describe, expect, it } from "vitest";
import {
  calculateChange,
  calculateMissing,
  computeCashSuggestions,
  calculateSplitTotal,
  calculateSplitRemaining,
  isSplitPaymentValid,
} from "./posCheckoutLogic";

describe("posCheckoutLogic — Rendu de monnaie espèces", () => {
  it("calcule la monnaie rendue exacte", () => {
    expect(calculateChange(20000, 13000)).toBe(7000);
    expect(calculateChange(15000, 12500)).toBe(2500);
    expect(calculateChange(10000, 10000)).toBe(0);
  });

  it("ne renvoie jamais de montant négatif si le montant reçu est inférieur", () => {
    expect(calculateChange(8000, 10000)).toBe(0);
  });

  it("calcule le montant manquant si insuffisant", () => {
    expect(calculateMissing(8000, 10000)).toBe(2000);
    expect(calculateMissing(15000, 10000)).toBe(0);
  });

  it("calcule des suggestions pertinentes de billets FCFA supérieurs au total", () => {
    const suggestions13k = computeCashSuggestions(13000);
    expect(suggestions13k).toContain(15000);
    expect(suggestions13k).toContain(20000);
    expect(suggestions13k.every((s) => s > 13000)).toBe(true);

    const suggestions6k = computeCashSuggestions(6500);
    expect(suggestions6k).toContain(10000);
    expect(suggestions6k.every((s) => s > 6500)).toBe(true);
  });
});

describe("posCheckoutLogic — Répartition paiement mixte (split payment)", () => {
  it("calcule le total alloué et le reste à payer", () => {
    const lines = [
      { amount: 10000 },
      { amount: 5000 },
    ];
    expect(calculateSplitTotal(lines)).toBe(15000);
    expect(calculateSplitRemaining(20000, 15000)).toBe(5000);
  });

  it("valide la complétude du paiement multiple", () => {
    const validLines = [
      { amount: 10000 },
      { amount: 10000 },
    ];
    expect(isSplitPaymentValid(20000, validLines)).toBe(true);

    const incompleteLines = [
      { amount: 10000 },
      { amount: 5000 },
    ];
    expect(isSplitPaymentValid(20000, incompleteLines)).toBe(false);

    const singleLine = [
      { amount: 20000 },
    ];
    expect(isSplitPaymentValid(20000, singleLine)).toBe(false);

    const zeroLine = [
      { amount: 20000 },
      { amount: 0 },
    ];
    expect(isSplitPaymentValid(20000, zeroLine)).toBe(false);
  });
});
