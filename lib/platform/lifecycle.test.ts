import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  tenant: null as null | { id: string; slug: string; name: string; status: string },
  profileIds: [] as string[],
  calls: {
    tenantUpdate: [] as Array<Record<string, unknown>>,
    tenantDelete: [] as Array<Record<string, unknown>>,
    auditCreate: [] as Array<Record<string, unknown>>,
    deleteMany: [] as Array<{ model: string; args: Record<string, unknown> }>,
  },
}));

const adminState = vi.hoisted(() => ({
  calls: { deleteUser: [] as string[] },
  deleteUserThrows: false,
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
  const deletionModels = [
    "orderLine",
    "orderStatusEvent",
    "stockMovement",
    "order",
    "customer",
    "notification",
    "storefrontPage",
    "promoCode",
    "product",
    "profile",
    "employeeRole",
  ];
  const tx: Record<string, unknown> = {
    tenant: {
      update: async (args: Record<string, unknown>) => {
        dbState.calls.tenantUpdate.push(args);
        return {};
      },
      delete: async (args: Record<string, unknown>) => {
        dbState.calls.tenantDelete.push(args);
        return {};
      },
    },
    platformAuditLog: {
      create: async (args: Record<string, unknown>) => {
        dbState.calls.auditCreate.push(args);
        return {};
      },
    },
  };
  for (const model of deletionModels) {
    tx[model] = {
      deleteMany: async (args: Record<string, unknown>) => {
        dbState.calls.deleteMany.push({ model, args });
        return { count: 0 };
      },
    };
  }
  return {
    prisma: {
      tenant: {
        findUnique: async () => dbState.tenant,
        update: (tx.tenant as { update: unknown }).update,
      },
      profile: {
        findMany: async () => dbState.profileIds.map((id) => ({ id })),
      },
      platformAuditLog: tx.platformAuditLog,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          if (adminState.deleteUserThrows) throw new Error("boom");
          adminState.calls.deleteUser.push(id);
          return {};
        },
      },
    },
  }),
}));

const updateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
// lib/tenant/index.ts (importé transitivement pour TENANTS_CACHE_TAG) enveloppe
// sa lecture avec unstable_cache ; en dehors d'une requête Next réelle, on se
// contente de retourner la fonction telle quelle (même idiome que actions.test.ts).
vi.mock("next/cache", () => ({
  updateTag,
  revalidatePath,
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

const { suspendTenant, reactivateTenant, archiveTenant, deleteTenant } = await import("@/lib/platform/lifecycle");

beforeEach(() => {
  authState.role = "super_admin";
  dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "active" };
  dbState.profileIds = [];
  dbState.calls.tenantUpdate = [];
  dbState.calls.tenantDelete = [];
  dbState.calls.auditCreate = [];
  dbState.calls.deleteMany = [];
  adminState.calls.deleteUser = [];
  adminState.deleteUserThrows = false;
  updateTag.mockClear();
  revalidatePath.mockClear();
});

describe("suspendTenant", () => {
  it("refuse un appelant qui n'est pas super_admin, sans toucher la base", async () => {
    authState.role = "owner";
    const result = await suspendTenant("t1", { reason: "" });
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
    expect(dbState.calls.tenantUpdate).toHaveLength(0);
  });

  it("passe la boutique en suspended avec la date et le motif", async () => {
    const result = await suspendTenant("t1", { reason: "Impayé" });
    expect(result).toEqual({ ok: true });
    const data = dbState.calls.tenantUpdate[0].data as Record<string, unknown>;
    expect(data.status).toBe("suspended");
    expect(data.suspendedReason).toBe("Impayé");
    expect(data.suspendedAt).toBeInstanceOf(Date);
  });

  it("trace tenant_suspended avec l'acteur réel et le motif", async () => {
    await suspendTenant("t1", { reason: "Impayé" });
    const data = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(data.action).toBe("tenant_suspended");
    expect(data.actorId).toBe("admin-1");
    expect(data.tenantId).toBe("t1");
    expect(data.metadata).toMatchObject({ reason: "Impayé", slug: "boutique-test" });
  });

  it("invalide l'étiquette de cache des tenants — sinon la vitrine reste en ligne 5 minutes", async () => {
    await suspendTenant("t1", { reason: "" });
    expect(updateTag).toHaveBeenCalledWith("tenants");
  });

  it("refuse de suspendre une boutique archivée, avec le message du spec §9", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await suspendTenant("t1", { reason: "" });
    expect(result).toEqual({
      ok: false,
      error: "Cette boutique est archivée : réactivez-la avant de la suspendre.",
    });
    expect(dbState.calls.tenantUpdate).toHaveLength(0);
  });

  it("renvoie « Boutique introuvable. » si l'id ne correspond à rien", async () => {
    dbState.tenant = null;
    const result = await suspendTenant("inconnu", { reason: "" });
    expect(result).toEqual({ ok: false, error: "Boutique introuvable." });
  });
});

describe("reactivateTenant", () => {
  it("remet une boutique suspendue en active et efface le motif", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "suspended" };
    const result = await reactivateTenant("t1");
    expect(result).toEqual({ ok: true });
    const data = dbState.calls.tenantUpdate[0].data as Record<string, unknown>;
    expect(data.status).toBe("active");
    expect(data.suspendedAt).toBeNull();
    expect(data.suspendedReason).toBeNull();
    expect(data.archivedAt).toBeNull();
  });

  it("réactive aussi une boutique archivée (spec §9 : archived → active)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await reactivateTenant("t1");
    expect(result).toEqual({ ok: true });
    expect(dbState.calls.auditCreate[0].data).toMatchObject({ action: "tenant_reactivated" });
  });

  it("refuse de réactiver une boutique déjà active", async () => {
    const result = await reactivateTenant("t1");
    expect(result).toEqual({ ok: false, error: "Cette boutique est déjà active." });
  });
});

describe("archiveTenant", () => {
  it("archive une boutique active et pose archivedAt", async () => {
    const result = await archiveTenant("t1");
    expect(result).toEqual({ ok: true });
    const data = dbState.calls.tenantUpdate[0].data as Record<string, unknown>;
    expect(data.status).toBe("archived");
    expect(data.archivedAt).toBeInstanceOf(Date);
    expect(dbState.calls.auditCreate[0].data).toMatchObject({ action: "tenant_archived" });
  });

  it("archive aussi une boutique suspendue (spec §9)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "suspended" };
    expect(await archiveTenant("t1")).toEqual({ ok: true });
  });

  it("refuse d'archiver une boutique déjà archivée", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await archiveTenant("t1");
    expect(result).toEqual({ ok: false, error: "Cette boutique est déjà archivée." });
  });
});

describe("deleteTenant", () => {
  it("refuse un appelant qui n'est pas super_admin, sans toucher la base", async () => {
    authState.role = "owner";
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
    expect(dbState.calls.deleteMany).toHaveLength(0);
  });

  it("REFUS 1 — refuse de supprimer une boutique active (spec §9)", async () => {
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result).toEqual({
      ok: false,
      error: "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord.",
    });
    expect(dbState.calls.deleteMany).toHaveLength(0);
  });

  it("REFUS 1 bis — refuse aussi de supprimer une boutique suspendue", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "suspended" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result.ok).toBe(false);
    expect(dbState.calls.deleteMany).toHaveLength(0);
  });

  it("REFUS 2 — refuse un slug de confirmation incorrect, sans effet de bord (spec §11)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-tests" });
    expect(result).toEqual({
      ok: false,
      error: "Le slug saisi ne correspond pas à celui de la boutique.",
    });
    expect(dbState.calls.deleteMany).toHaveLength(0);
    expect(dbState.calls.auditCreate).toHaveLength(0);
  });

  it("supprime une boutique archivée dont le slug est confirmé", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result).toEqual({ ok: true });
    expect(dbState.calls.tenantDelete).toHaveLength(1);
  });

  it("écrit tenant_deleted en conservant le nom et le slug dans metadata (spec §9)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    await deleteTenant("t1", { confirmSlug: "boutique-test" });
    const audit = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(audit.action).toBe("tenant_deleted");
    expect(audit.metadata).toMatchObject({ slug: "boutique-test", name: "Boutique Test" });
  });

  it("supprime les comptes Auth au mieux, après la transaction", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    dbState.profileIds = ["owner-1", "staff-1"];
    await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(adminState.calls.deleteUser).toEqual(["owner-1", "staff-1"]);
  });

  it("réussit quand même si la suppression d'un compte Auth échoue — la base fait foi", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    dbState.profileIds = ["owner-1"];
    adminState.deleteUserThrows = true;
    expect(await deleteTenant("t1", { confirmSlug: "boutique-test" })).toEqual({ ok: true });
  });

  it("accepte un slug de confirmation avec des espaces autour (trim du schéma Zod)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    expect(await deleteTenant("t1", { confirmSlug: "  boutique-test  " })).toEqual({ ok: true });
  });
});
