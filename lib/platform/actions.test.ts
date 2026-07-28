import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    userId: "u1",
    name: "Aya",
    role: "owner",
    tenantId: "t1",
    permissions: [],
    enabledModules: ["dash"],
  }),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: async () => {
      throw new Error("la base ne doit jamais être atteinte sans garde");
    },
    tenant: {
      findFirst: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("aucun compte Auth ne doit être créé sans garde");
  },
}));

import { createTenant } from "./actions";

const denied = { ok: false, error: "Une erreur est survenue, réessayez." };

const VALID_INPUT = {
  slug: "boutique-du-plateau",
  name: "Boutique du Plateau",
  plan: "essentiel" as const,
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "BDP",
  domains: [],
  ownerName: "Aya Koné",
  ownerEmail: "aya@example.com",
  ownerPassword: "motdepasse1",
};

describe("createTenant — réservée au prestataire", () => {
  it("refuse une gérante sans toucher ni à la base ni à Supabase Auth", async () => {
    expect(await createTenant(VALID_INPUT)).toEqual(denied);
  });
});
