import { describe, expect, it } from "vitest";
import { STOCK_MOVEMENT_REASON_LABELS } from "./stockMovementLabels";

describe("STOCK_MOVEMENT_REASON_LABELS", () => {
  it("a un libellé FR pour chaque raison", () => {
    expect(STOCK_MOVEMENT_REASON_LABELS.vente_pos).toBe("Vente boutique");
    expect(STOCK_MOVEMENT_REASON_LABELS.vente_web).toBe("Vente en ligne");
    expect(STOCK_MOVEMENT_REASON_LABELS.reception).toBe(
      "Entrée atelier / Réception"
    );
    expect(STOCK_MOVEMENT_REASON_LABELS.perte).toBe("Perte ou casse");
    expect(STOCK_MOVEMENT_REASON_LABELS.correction).toBe(
      "Correction d'inventaire"
    );
  });
});
