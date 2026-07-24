import { describe, it, expect } from "vitest";
import { employeeRoleSchema, createEmployeeSchema } from "./team";

describe("employeeRoleSchema", () => {
  const valid = { name: "Caissier", permissions: ["pos", "orders"] };

  it("accepte un nom et une liste de modules valides", () => {
    expect(employeeRoleSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un nom trop court", () => {
    expect(employeeRoleSchema.safeParse({ ...valid, name: "C" }).success).toBe(false);
  });

  it("refuse une liste de modules vide", () => {
    expect(employeeRoleSchema.safeParse({ ...valid, permissions: [] }).success).toBe(false);
  });

  it("refuse un id de module inconnu", () => {
    expect(employeeRoleSchema.safeParse({ ...valid, permissions: ["not-a-module"] }).success).toBe(false);
  });
});

describe("createEmployeeSchema", () => {
  const valid = { name: "Awa Traoré", email: "awa@example.com", password: "password123", employeeRoleId: "r1" };

  it("accepte des informations valides", () => {
    expect(createEmployeeSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un email invalide", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, email: "pas-un-email" }).success).toBe(false);
  });

  it("refuse un mot de passe trop court", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("refuse un employeeRoleId vide", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, employeeRoleId: "" }).success).toBe(false);
  });
});
