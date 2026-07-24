import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ userId: "u1", name: "Awa", role: "staff", permissions: ["pos"] }),
}));

import {
  createEmployeeRole,
  updateEmployeeRole,
  deleteEmployeeRole,
  createEmployee,
  setEmployeeActive,
  setEmployeeRole,
} from "./actions";

const denied = { ok: false, error: "Une erreur est survenue, réessayez." };

describe("team actions — réservées à owner", () => {
  it("rejette createEmployeeRole pour un compte non-owner", async () => {
    expect(await createEmployeeRole({ name: "Caissier", permissions: ["pos"] })).toEqual(denied);
  });

  it("rejette updateEmployeeRole pour un compte non-owner", async () => {
    expect(await updateEmployeeRole("r1", { name: "Caissier", permissions: ["pos"] })).toEqual(denied);
  });

  it("rejette deleteEmployeeRole pour un compte non-owner", async () => {
    expect(await deleteEmployeeRole("r1")).toEqual(denied);
  });

  it("rejette createEmployee pour un compte non-owner", async () => {
    expect(
      await createEmployee({ name: "Awa", email: "awa@example.com", password: "password123", employeeRoleId: "r1" })
    ).toEqual(denied);
  });

  it("rejette setEmployeeActive pour un compte non-owner", async () => {
    expect(await setEmployeeActive("p1", false)).toEqual(denied);
  });

  it("rejette setEmployeeRole pour un compte non-owner", async () => {
    expect(await setEmployeeRole("p1", "r1")).toEqual(denied);
  });
});
