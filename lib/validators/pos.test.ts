import { describe, expect, it } from "vitest";
import { posSaleSchema } from "./pos";

const base = { lines: [{ productId: "p1", qty: 1 }] };

describe("posSaleSchema — modes de paiement", () => {
  it("accepte les 6 modes proposés au POS", () => {
    for (const pm of ["espece", "orange_money", "wave", "moov_money", "mtn_momo", "mixte"]) {
      expect(posSaleSchema.safeParse({ ...base, paymentMethod: pm }).success).toBe(true);
    }
  });

  it("refuse le mm générique (réservé à l'historique)", () => {
    expect(posSaleSchema.safeParse({ ...base, paymentMethod: "mm" }).success).toBe(false);
  });
});

describe("posSaleSchema — remises", () => {
  it("accepte promoCode et pointsRequested optionnels", () => {
    const r = posSaleSchema.safeParse({ ...base, paymentMethod: "espece", promoCode: " teranga10 ", pointsRequested: 20 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.promoCode).toBe("teranga10"); // trim seul — la normalisation MAJUSCULES vit côté lookup
      expect(r.data.pointsRequested).toBe(20);
    }
  });
  it("refuse des points négatifs et défaut 0", () => {
    expect(posSaleSchema.safeParse({ ...base, paymentMethod: "espece", pointsRequested: -1 }).success).toBe(false);
    const r = posSaleSchema.safeParse({ ...base, paymentMethod: "espece" });
    expect(r.success && r.data.pointsRequested === 0).toBe(true);
  });
});

describe("posSaleSchema — montant reçu et paiements multiples", () => {
  it("accepte amountReceived et changeGiven valides", () => {
    const r = posSaleSchema.safeParse({
      ...base,
      paymentMethod: "espece",
      amountReceived: 20000,
      changeGiven: 7500,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amountReceived).toBe(20000);
      expect(r.data.changeGiven).toBe(7500);
    }
  });

  it("accepte splitPayments valides pour un paiement mixte", () => {
    const r = posSaleSchema.safeParse({
      ...base,
      paymentMethod: "mixte",
      splitPayments: [
        { method: "espece", amount: 10000, amountReceived: 10000, changeGiven: 0 },
        { method: "wave", amount: 10000 },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.splitPayments).toHaveLength(2);
      expect(r.data.splitPayments?.[0].method).toBe("espece");
      expect(r.data.splitPayments?.[0].amount).toBe(10000);
      expect(r.data.splitPayments?.[1].method).toBe("wave");
    }
  });

  it("refuse un montant négatif ou zéro dans splitPayments", () => {
    const r = posSaleSchema.safeParse({
      ...base,
      paymentMethod: "mixte",
      splitPayments: [{ method: "espece", amount: 0 }],
    });
    expect(r.success).toBe(false);
  });
});
