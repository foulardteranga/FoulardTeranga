import { describe, expect, it } from "vitest";
import { orderArchiveSchema, orderDeleteSchema } from "./orderArchive";

describe("orderArchiveSchema", () => {
  it("accepte l'absence de motif", () => {
    expect(orderArchiveSchema.safeParse({}).success).toBe(true);
  });

  it("accepte un motif optionnel", () => {
    expect(orderArchiveSchema.safeParse({ reason: "Doublon de saisie" }).success).toBe(true);
  });

  it("borne le motif à 200 caractères", () => {
    expect(orderArchiveSchema.safeParse({ reason: "x".repeat(201) }).success).toBe(false);
  });
});

describe("orderDeleteSchema", () => {
  it("refuse un motif absent", () => {
    expect(orderDeleteSchema.safeParse({}).success).toBe(false);
  });

  it("refuse un motif trop court", () => {
    expect(orderDeleteSchema.safeParse({ reason: "ok" }).success).toBe(false);
  });

  it("accepte un motif valide", () => {
    expect(orderDeleteSchema.safeParse({ reason: "Commande de test, doublon" }).success).toBe(true);
  });

  it("rejette un motif uniquement composé d'espaces", () => {
    expect(orderDeleteSchema.safeParse({ reason: "    " }).success).toBe(false);
  });
});
