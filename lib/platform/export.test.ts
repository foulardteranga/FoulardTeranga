import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  tenant: null as null | { id: string; slug: string; name: string; status: string },
  calls: {
    findMany: [] as Array<{ model: string; where: unknown }>,
    auditCreate: [] as Array<Record<string, unknown>>,
  },
}));

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

vi.mock("@/lib/db/client", () => {
  function findManyFor(model: string) {
    return async (args: Record<string, unknown>) => {
      dbState.calls.findMany.push({ model, where: args.where });
      return [];
    };
  }
  return {
    prisma: {
      tenant: { findUnique: async () => dbState.tenant },
      product: { findMany: findManyFor("product") },
      customer: { findMany: findManyFor("customer") },
      order: { findMany: findManyFor("order") },
      storefrontPage: { findMany: findManyFor("storefrontPage") },
      promoCode: { findMany: findManyFor("promoCode") },
      stockMovement: { findMany: findManyFor("stockMovement") },
      platformAuditLog: {
        create: async (args: Record<string, unknown>) => {
          dbState.calls.auditCreate.push(args);
          return {};
        },
      },
    },
  };
});

const { exportTenantData } = await import("@/lib/platform/export");

beforeEach(() => {
  authState.role = "super_admin";
  dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "active" };
  dbState.calls.findMany = [];
  dbState.calls.auditCreate = [];
});

describe("exportTenantData", () => {
  it("refuse un appelant qui n'est pas super_admin", async () => {
    authState.role = "owner";
    const result = await exportTenantData("t1");
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });

  it("renvoie « Boutique introuvable. » pour un id inconnu", async () => {
    dbState.tenant = null;
    expect(await exportTenantData("inconnu")).toEqual({ ok: false, error: "Boutique introuvable." });
  });

  it("exporte les six collections du spec §10", async () => {
    const result = await exportTenantData("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = JSON.parse(result.json);
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining([
        "tenant",
        "products",
        "customers",
        "orders",
        "storefrontPages",
        "promoCodes",
        "stockMovements",
        "exportedAt",
      ])
    );
  });

  it("nomme le fichier avec le slug et la date", async () => {
    const result = await exportTenantData("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toMatch(/^boutique-test-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("trace data_exported avec le slug conservé dans metadata", async () => {
    await exportTenantData("t1");
    const audit = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(audit.action).toBe("data_exported");
    expect(audit.tenantId).toBe("t1");
    expect(audit.metadata).toMatchObject({ slug: "boutique-test" });
  });

  it("filtre chaque collection sur le tenant exporté", async () => {
    await exportTenantData("t1");
    for (const call of dbState.calls.findMany) {
      expect((call.where as Record<string, unknown>).tenantId).toBe("t1");
    }
  });
});
