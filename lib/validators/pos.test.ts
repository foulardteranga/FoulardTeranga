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
