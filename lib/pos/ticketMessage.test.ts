import { describe, expect, it } from "vitest";
import { buildTicketMessage, type TicketMessageInput } from "./ticketMessage";

const base: TicketMessageInput = {
  shopName: "Foulard Teranga",
  ref: "#TER-1042",
  date: new Date(2026, 6, 20, 14, 32),
  lines: [
    { name: "Foulard tissé main", qty: 2, lineTotal: 24000 },
    { name: "Turban wax", qty: 1, lineTotal: 8500 },
  ],
  subtotal: 32500,
  discount: 0,
  total: 32500,
  payLabel: "Wave",
  loyalty: null,
};

describe("buildTicketMessage", () => {
  it("liste l'en-tête, chaque article et le total avec le mode de paiement", () => {
    const msg = buildTicketMessage(base);
    expect(msg).toContain("*Foulard Teranga*");
    expect(msg).toContain("#TER-1042");
    expect(msg).toContain("• Foulard tissé main × 2 — 24 000 FCFA");
    expect(msg).toContain("• Turban wax × 1 — 8 500 FCFA");
    expect(msg).toContain("*Total payé : 32 500 FCFA* (Wave)");
  });

  it("omet sous-total et remise quand il n'y a aucune remise", () => {
    const msg = buildTicketMessage(base);
    expect(msg).not.toContain("Sous-total");
    expect(msg).not.toContain("Remise");
  });

  it("affiche sous-total et remise quand une remise existe", () => {
    const msg = buildTicketMessage({ ...base, discount: 3250, total: 29250 });
    expect(msg).toContain("Sous-total : 32 500 FCFA");
    expect(msg).toContain("Remise : −3 250 FCFA");
    expect(msg).toContain("*Total payé : 29 250 FCFA* (Wave)");
  });

  it("affiche le bloc fidélité seulement si une cliente est rattachée", () => {
    expect(buildTicketMessage(base)).not.toContain("Points gagnés");
    const msg = buildTicketMessage({ ...base, loyalty: { pointsEarned: 32, newBalance: 96 } });
    expect(msg).toContain("⭐ Points gagnés : 32 · Nouveau solde : 96");
  });

  it("contient la date au format français", () => {
    expect(buildTicketMessage(base)).toContain("20/07/2026");
  });
});
