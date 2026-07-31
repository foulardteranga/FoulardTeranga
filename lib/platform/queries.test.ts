import { describe, it, expect, vi, beforeEach } from "vitest";

// État partagé, déclaré via vi.hoisted pour rester accessible depuis les
// factories vi.mock (elles-mêmes hoistées au-dessus des imports). Par défaut
// tout reste en mode "throw" : les tests de refus existants continuent de
// prouver que la base n'est jamais atteinte sans la garde super_admin ; les
// nouveaux tests "succès" basculent explicitement en mode "record" pour
// capturer les appels au lieu de lever (même idiome que actions.test.ts).
const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  mode: "throw" as "throw" | "record",
  findUniqueResult: null as null | Record<string, unknown>,
  calls: {
    findMany: [] as Array<Record<string, unknown>>,
    findUnique: [] as Array<Record<string, unknown>>,
  },
}));

function resetTestState() {
  authState.role = "owner";
  dbState.mode = "throw";
  dbState.findUniqueResult = null;
  dbState.calls.findMany = [];
  dbState.calls.findUnique = [];
}

// Session de gérante : aucune fonction de ce module ne doit lui répondre.
vi.mock("@/lib/impersonation/context", () => ({
  getActorContext: async () =>
    authState.role === "super_admin"
      ? {
          actor: { userId: "admin-1", name: "Admin Plateforme", role: "super_admin" },
          effective: { tenantId: null, role: "super_admin", permissions: [] },
          impersonation: null,
        }
      : {
          actor: { userId: "u1", name: "Aya", role: "owner" },
          effective: { tenantId: "t1", role: "owner", permissions: [] },
          impersonation: null,
        },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    tenant: {
      findMany: async (args: Record<string, unknown>) => {
        if (dbState.mode === "throw") {
          throw new Error("la base ne doit jamais être atteinte sans garde");
        }
        dbState.calls.findMany.push(args);
        return [];
      },
      findUnique: async (args: Record<string, unknown>) => {
        if (dbState.mode === "throw") {
          throw new Error("la base ne doit jamais être atteinte sans garde");
        }
        dbState.calls.findUnique.push(args);
        return dbState.findUniqueResult;
      },
      findFirst: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
    },
  },
}));

import { listTenants, getTenantBySlug, findTenantByDomain, tenantSlugExists } from "./queries";

describe("lib/platform/queries — garde super_admin", () => {
  beforeEach(resetTestState);

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

describe("listTenants — archivage", () => {
  beforeEach(resetTestState);

  it("exclut les boutiques archivées par défaut", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";

    await listTenants();

    expect(dbState.calls.findMany).toHaveLength(1);
    expect(dbState.calls.findMany[0].where).toEqual({ status: { not: "archived" } });
  });

  it("les inclut quand le prestataire le demande explicitement", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";

    await listTenants({ includeArchived: true });

    expect(dbState.calls.findMany).toHaveLength(1);
    expect(dbState.calls.findMany[0].where).toBeUndefined();
  });
});

describe("getTenantBySlug — colonnes de cycle de vie", () => {
  beforeEach(resetTestState);

  it("remonte suspendedAt, suspendedReason et archivedAt", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.findUniqueResult = {
      id: "t1",
      slug: "boutique-test",
      name: "Boutique Test",
      tagline: "",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      font: "Playfair Display",
      logoText: "BT",
      whatsappPhone: null,
      domains: [],
      status: "active",
      plan: "essentiel",
      enabledModules: [],
      createdAt: new Date("2026-01-01"),
      suspendedAt: null,
      suspendedReason: null,
      archivedAt: null,
      profiles: [],
    };

    const detail = await getTenantBySlug("boutique-test");

    expect(detail).toMatchObject({
      suspendedAt: null,
      suspendedReason: null,
      archivedAt: null,
    });
  });
});
