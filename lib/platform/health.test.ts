import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ role: "super_admin" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  productCount: 12,
  outOfStockCount: 3,
  ordersLast30Days: 7,
  publishedPage: { publishedAt: new Date("2026-07-01T00:00:00Z") } as { publishedAt: Date | null } | null,
  countCalls: [] as Array<Record<string, unknown>>,
}));

const adminState = vi.hoisted(() => ({
  lastSignInAt: "2026-07-29T08:00:00.000Z" as string | null,
  error: null as null | { message: string },
  getUserByIdCalls: [] as string[],
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

vi.mock("@/lib/db/client", () => ({
  prisma: {
    product: {
      count: async (args: Record<string, unknown>) => {
        dbState.countCalls.push({ model: "product", ...args });
        const where = args.where as Record<string, unknown>;
        return where.stock ? dbState.outOfStockCount : dbState.productCount;
      },
    },
    order: {
      count: async (args: Record<string, unknown>) => {
        dbState.countCalls.push({ model: "order", ...args });
        return dbState.ordersLast30Days;
      },
    },
    storefrontPage: {
      findFirst: async () => dbState.publishedPage,
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => {
          adminState.getUserByIdCalls.push(id);
          if (adminState.error) return { data: { user: null }, error: adminState.error };
          return { data: { user: { last_sign_in_at: adminState.lastSignInAt } }, error: null };
        },
      },
    },
  }),
}));

const { getTenantHealth } = await import("@/lib/platform/health");

beforeEach(() => {
  authState.role = "super_admin";
  dbState.countCalls = [];
  dbState.publishedPage = { publishedAt: new Date("2026-07-01T00:00:00Z") };
  adminState.lastSignInAt = "2026-07-29T08:00:00.000Z";
  adminState.error = null;
  adminState.getUserByIdCalls = [];
});

describe("getTenantHealth", () => {
  it("lève si l'appelant n'est pas super_admin", async () => {
    authState.role = "owner";
    await expect(getTenantHealth("t1", "owner-1")).rejects.toThrow("Accès plateforme refusé.");
  });

  it("rapporte les cinq indicateurs du spec §10", async () => {
    const health = await getTenantHealth("t1", "owner-1");
    expect(health).toEqual({
      productCount: 12,
      outOfStockCount: 3,
      ordersLast30Days: 7,
      storefrontPublished: true,
      ownerLastSignInAt: new Date("2026-07-29T08:00:00.000Z"),
    });
  });

  it("considère la vitrine non publiée quand aucune page n'a de publishedAt", async () => {
    dbState.publishedPage = null;
    const health = await getTenantHealth("t1", "owner-1");
    expect(health.storefrontPublished).toBe(false);
  });

  it("renvoie null pour la dernière connexion quand la boutique n'a pas de gérante", async () => {
    const health = await getTenantHealth("t1", null);
    expect(health.ownerLastSignInAt).toBeNull();
    expect(adminState.getUserByIdCalls).toHaveLength(0);
  });

  it("dégrade en null plutôt que de lever si Supabase Auth répond une erreur — le diagnostic ne doit jamais casser la fiche", async () => {
    adminState.error = { message: "User not found" };
    const health = await getTenantHealth("t1", "owner-1");
    expect(health.ownerLastSignInAt).toBeNull();
    expect(health.productCount).toBe(12);
  });

  it("filtre toutes les requêtes sur le tenant demandé", async () => {
    await getTenantHealth("t1", "owner-1");
    for (const call of dbState.countCalls) {
      expect((call.where as Record<string, unknown>).tenantId).toBe("t1");
    }
  });
});
