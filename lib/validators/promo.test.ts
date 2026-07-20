import { describe, it, expect } from "vitest";
import { promoCreateSchema } from "./promo";

const valid = { code: "teranga10", kind: "percent", value: 10, vipOnly: false };

describe("promoCreateSchema", () => {
  it("accepte un code valide et le normalise en majuscules", () => {
    const r = promoCreateSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("TERANGA10");
  });
  it("refuse un code trop court ou avec caractères invalides", () => {
    expect(promoCreateSchema.safeParse({ ...valid, code: "AB" }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...valid, code: "TER ANGA" }).success).toBe(false);
  });
  it("borne percent à 1-100", () => {
    expect(promoCreateSchema.safeParse({ ...valid, value: 0 }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...valid, value: 101 }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...valid, value: 100 }).success).toBe(true);
  });
  it("accepte un montant fixe positif", () => {
    expect(promoCreateSchema.safeParse({ ...valid, kind: "amount", value: 2000 }).success).toBe(true);
    expect(promoCreateSchema.safeParse({ ...valid, kind: "amount", value: 0 }).success).toBe(false);
  });
  it("refuse une période incohérente (fin avant début)", () => {
    const r = promoCreateSchema.safeParse({ ...valid, startsAt: "2026-07-20", endsAt: "2026-07-10" });
    expect(r.success).toBe(false);
  });
  it("accepte les dates optionnelles absentes", () => {
    expect(promoCreateSchema.safeParse(valid).success).toBe(true);
  });
});
