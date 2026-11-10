import { describe, expect, it } from "vitest";
import { customOrderSchema } from "./customOrder";

const base = {
  clientName: "Awa Diop",
  place: "Cocody",
  phone: "0102030405",
  total: 25000,
};

describe("customOrderSchema", () => {
  it("accepte le minimum requis (nom, lieu, téléphone, prix)", () => {
    expect(customOrderSchema.safeParse(base).success).toBe(true);
  });

  it("accepte tous les champs optionnels renseignés", () => {
    const result = customOrderSchema.safeParse({
      ...base,
      colorName: "Bordeaux",
      colorHex: "#6B1D2F",
      fabricNote: "Bazin brodé, motif wax",
      model: "Robe wax ajustée",
      modelImageUrl: "https://example.supabase.co/storage/v1/object/public/images/t1/products/abc.webp",
      dueDate: "2026-12-01",
      deposit: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeInstanceOf(Date);
      expect(result.data.deposit).toBe(5000);
    }
  });

  it("rejette un nom trop court", () => {
    expect(customOrderSchema.safeParse({ ...base, clientName: "A" }).success).toBe(false);
  });

  it("rejette un téléphone invalide", () => {
    expect(customOrderSchema.safeParse({ ...base, phone: "abc" }).success).toBe(false);
  });

  it("rejette un prix absent", () => {
    const { total, ...rest } = base;
    expect(customOrderSchema.safeParse(rest).success).toBe(false);
  });

  it("rejette un prix inférieur à 100 FCFA", () => {
    expect(customOrderSchema.safeParse({ ...base, total: 50 }).success).toBe(false);
  });

  it("coerce un prix envoyé en chaîne (NumericField renvoie une string)", () => {
    const result = customOrderSchema.safeParse({ ...base, total: "15000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.total).toBe(15000);
  });

  it("traite une date de livraison vide comme absente", () => {
    const result = customOrderSchema.safeParse({ ...base, dueDate: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dueDate).toBeUndefined();
  });

  it("accepte l'absence totale de champs optionnels", () => {
    expect(customOrderSchema.safeParse(base).success).toBe(true);
  });
});
