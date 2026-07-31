import { describe, expect, it, vi } from "vitest";

// submitWebOrder est le checkout public de la vitrine (visiteuse anonyme,
// pas de session) : ce test ne couvre que son refus sur une boutique non
// active (Tâche 17), avant toute écriture — la boutique est résolue puis
// immédiatement contrôlée, donc aucun mock de prisma/transaction n'est requis
// pour ce cas précis (le refus intervient avant tout accès base).
const tenantState = vi.hoisted(() => ({ status: "active" as string }));
vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => ({
    id: "t1",
    slug: "foulard-teranga",
    name: "Foulard Teranga",
    status: tenantState.status,
    theme: {},
    domains: [],
  }),
}));

import { submitWebOrder } from "./actions";

const validKyc = { name: "Awa Diop", place: "Cocody", phone: "0102030405", note: "", wa: true };

describe("submitWebOrder — boutique suspendue/archivée", () => {
  it("refuse la commande avec un message client neutre quand la boutique est suspendue", async () => {
    tenantState.status = "suspended";
    const result = await submitWebOrder(validKyc, []);
    expect(result).toEqual({
      ok: false,
      error: "Cette boutique n'accepte plus de commandes pour le moment.",
    });
  });

  it("refuse la commande quand la boutique est archivée", async () => {
    tenantState.status = "archived";
    const result = await submitWebOrder(validKyc, []);
    expect(result.ok).toBe(false);
  });
});
