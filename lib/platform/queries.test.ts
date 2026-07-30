import { describe, it, expect, vi } from "vitest";

// Session de gérante : aucune fonction de ce module ne doit lui répondre.
vi.mock("@/lib/impersonation/context", () => ({
  getActorContext: async () => ({
    actor: { userId: "u1", name: "Aya", role: "owner" },
    effective: { tenantId: "t1", role: "owner", permissions: [] },
    impersonation: null,
  }),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    tenant: {
      findMany: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
      findUnique: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
      findFirst: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
    },
  },
}));

import { listTenants, getTenantBySlug, findTenantByDomain, tenantSlugExists } from "./queries";

describe("lib/platform/queries — garde super_admin", () => {
  it("refuse listTenants à une gérante", async () => {
    await expect(listTenants()).rejects.toThrow("Accès plateforme refusé.");
  });

  it("refuse getTenantBySlug à une gérante", async () => {
    await expect(getTenantBySlug("foulard-teranga")).rejects.toThrow("Accès plateforme refusé.");
  });

  it("refuse findTenantByDomain à une gérante", async () => {
    await expect(findTenantByDomain("boutique.ci")).rejects.toThrow("Accès plateforme refusé.");
  });

  it("refuse tenantSlugExists à une gérante", async () => {
    await expect(tenantSlugExists("foulard-teranga")).rejects.toThrow("Accès plateforme refusé.");
  });
});
