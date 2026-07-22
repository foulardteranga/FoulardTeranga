import { describe, it, expect } from "vitest";
import { validatePromo, applyDiscounts, type PromoRule } from "./engine";

const base: PromoRule = {
  kind: "percent", value: 10, minTotal: null, startsAt: null, endsAt: null, vipOnly: false, active: true,
};
const now = new Date(2026, 6, 20, 12, 0);

describe("validatePromo", () => {
  it("accepte un code actif sans contrainte", () => {
    expect(validatePromo(base, { now, subtotal: 10000, isVip: false })).toEqual({ ok: true });
  });
  it("refuse un code inconnu (null)", () => {
    expect(validatePromo(null, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code inconnu ou inactif" });
  });
  it("refuse un code inactif", () => {
    expect(validatePromo({ ...base, active: false }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code inconnu ou inactif" });
  });
  it("refuse un code pas encore actif", () => {
    expect(validatePromo({ ...base, startsAt: new Date(2026, 6, 21) }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code pas encore actif" });
  });
  it("refuse un code expiré", () => {
    expect(validatePromo({ ...base, endsAt: new Date(2026, 6, 19) }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code expiré" });
  });
  it("refuse sous l'achat minimum, avec le montant dans le message", () => {
    expect(validatePromo({ ...base, minTotal: 25000 }, { now, subtotal: 24999, isVip: false })).toEqual({ ok: false, reason: "Achat minimum de 25 000 FCFA non atteint" });
  });
  it("accepte à l'achat minimum exact", () => {
    expect(validatePromo({ ...base, minTotal: 25000 }, { now, subtotal: 25000, isVip: false })).toEqual({ ok: true });
  });
  it("refuse un code VIP pour une cliente non VIP, l'accepte pour une VIP", () => {
    expect(validatePromo({ ...base, vipOnly: true }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Réservé aux clientes VIP" });
    expect(validatePromo({ ...base, vipOnly: true }, { now, subtotal: 10000, isVip: true })).toEqual({ ok: true });
  });
});

describe("applyDiscounts", () => {
  it("applique un pourcentage arrondi au FCFA", () => {
    const r = applyDiscounts({ subtotal: 32500, promo: base, pointsRequested: 0, pointsBalance: 0 });
    expect(r).toEqual({ promoDiscount: 3250, pointsUsed: 0, pointsDiscount: 0, total: 29250 });
  });
  it("plafonne un montant fixe au sous-total", () => {
    const r = applyDiscounts({ subtotal: 3000, promo: { ...base, kind: "amount", value: 5000 }, pointsRequested: 0, pointsBalance: 0 });
    expect(r).toEqual({ promoDiscount: 3000, pointsUsed: 0, pointsDiscount: 0, total: 0 });
  });
  it("cumule promo puis points sur le restant", () => {
    const r = applyDiscounts({ subtotal: 32500, promo: base, pointsRequested: 20, pointsBalance: 96 });
    expect(r).toEqual({ promoDiscount: 3250, pointsUsed: 20, pointsDiscount: 1000, total: 28250 });
  });
  it("plafonne les points au solde disponible", () => {
    const r = applyDiscounts({ subtotal: 32500, promo: null, pointsRequested: 100, pointsBalance: 12 });
    expect(r.pointsUsed).toBe(12);
    expect(r.pointsDiscount).toBe(600);
    expect(r.total).toBe(31900);
  });
  it("plafonne les points au restant à payer (jamais de total négatif, aucun point gâché)", () => {
    const r = applyDiscounts({ subtotal: 1000, promo: null, pointsRequested: 100, pointsBalance: 100 });
    expect(r.pointsUsed).toBe(20); // 20 × 50 = 1 000, pas un point de plus
    expect(r.total).toBe(0);
  });
  it("ignore les demandes de points négatives", () => {
    const r = applyDiscounts({ subtotal: 5000, promo: null, pointsRequested: -5, pointsBalance: 50 });
    expect(r.pointsUsed).toBe(0);
    expect(r.total).toBe(5000);
  });
  it("sans promo ni points, total = sous-total", () => {
    expect(applyDiscounts({ subtotal: 12500, pointsRequested: 0, pointsBalance: 0 })).toEqual({ promoDiscount: 0, pointsUsed: 0, pointsDiscount: 0, total: 12500 });
  });
});
