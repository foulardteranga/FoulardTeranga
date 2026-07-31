import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  profile: { id: "owner-1", tenantId: "t1", role: "owner", name: "Aya", email: "a@b.c" } as null | {
    id: string;
    tenantId: string;
    role: string;
    name: string;
    email: string;
  },
  existingOwner: null as null | { id: string },
  tenant: { slug: "boutique-test" } as null | { slug: string },
  transactionThrows: false,
  calls: {
    profileCreate: [] as Array<Record<string, unknown>>,
    auditCreate: [] as Array<Record<string, unknown>>,
  },
}));

const adminState = vi.hoisted(() => ({
  updateUserError: null as null | { message: string },
  createUserError: null as null | { message: string },
  calls: {
    updateUserById: [] as Array<[string, Record<string, unknown>]>,
    createUser: [] as Array<Record<string, unknown>>,
    deleteUser: [] as string[],
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
  const tx = {
    profile: {
      create: async (args: Record<string, unknown>) => {
        dbState.calls.profileCreate.push(args);
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
  return {
    prisma: {
      profile: {
        findUnique: async () => dbState.profile,
        findFirst: async () => dbState.existingOwner,
        create: tx.profile.create,
      },
      tenant: {
        findUnique: async () => dbState.tenant,
      },
      platformAuditLog: tx.platformAuditLog,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        if (dbState.transactionThrows) throw new Error("boom");
        return fn(tx);
      },
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        updateUserById: async (id: string, attrs: Record<string, unknown>) => {
          adminState.calls.updateUserById.push([id, attrs]);
          if (adminState.updateUserError) return { data: { user: null }, error: adminState.updateUserError };
          return { data: { user: { id } }, error: null };
        },
        createUser: async (attrs: Record<string, unknown>) => {
          adminState.calls.createUser.push(attrs);
          if (adminState.createUserError) return { data: { user: null }, error: adminState.createUserError };
          return { data: { user: { id: "owner-new-id" } }, error: null };
        },
        deleteUser: async (id: string) => {
          adminState.calls.deleteUser.push(id);
          return { data: {}, error: null };
        },
      },
    },
  }),
}));

const updateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({
  updateTag,
  revalidatePath,
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

const { resetOwnerPassword, createTenantOwner } = await import("@/lib/platform/team");

beforeEach(() => {
  authState.role = "super_admin";
  dbState.profile = { id: "owner-1", tenantId: "t1", role: "owner", name: "Aya", email: "a@b.c" };
  dbState.existingOwner = null;
  dbState.tenant = { slug: "boutique-test" };
  dbState.transactionThrows = false;
  dbState.calls.profileCreate = [];
  dbState.calls.auditCreate = [];
  adminState.updateUserError = null;
  adminState.createUserError = null;
  adminState.calls.updateUserById = [];
  adminState.calls.createUser = [];
  adminState.calls.deleteUser = [];
  updateTag.mockClear();
  revalidatePath.mockClear();
});

describe("resetOwnerPassword", () => {
  it("refuse un appelant qui n'est pas super_admin, sans toucher Supabase Auth", async () => {
    authState.role = "owner";
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
    expect(adminState.calls.updateUserById).toHaveLength(0);
  });

  it("refuse un mot de passe trop court avant tout appel réseau", async () => {
    const result = await resetOwnerPassword("t1", "owner-1", { password: "court" });
    expect(result).toEqual({ ok: false, error: "8 caractères minimum." });
    expect(adminState.calls.updateUserById).toHaveLength(0);
  });

  it("refuse de réinitialiser un profil qui n'appartient pas à cette boutique", async () => {
    dbState.profile = { id: "owner-1", tenantId: "AUTRE", role: "owner", name: "Aya", email: "a@b.c" };
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result).toEqual({ ok: false, error: "Cette gérante n'appartient pas à cette boutique." });
    expect(adminState.calls.updateUserById).toHaveLength(0);
  });

  it("met à jour le mot de passe et trace owner_password_reset", async () => {
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result).toEqual({ ok: true });
    expect(adminState.calls.updateUserById[0]).toEqual(["owner-1", { password: "nouveaumdp1" }]);
    const audit = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(audit.action).toBe("owner_password_reset");
    expect(audit.actorId).toBe("admin-1");
    expect(audit.targetId).toBe("owner-1");
    expect(JSON.stringify(audit.metadata)).not.toContain("nouveaumdp1");
  });

  it("ne trace rien si Supabase Auth échoue", async () => {
    adminState.updateUserError = { message: "boom" };
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result.ok).toBe(false);
    expect(dbState.calls.auditCreate).toHaveLength(0);
  });
});

describe("createTenantOwner", () => {
  it("refuse si la boutique a déjà une gérante", async () => {
    dbState.existingOwner = { id: "owner-1" };
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result).toEqual({ ok: false, error: "Cette boutique a déjà une gérante." });
    expect(adminState.calls.createUser).toHaveLength(0);
  });

  it("crée le compte Auth puis le Profile, et trace owner_created", async () => {
    dbState.existingOwner = null;
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result).toEqual({ ok: true });
    expect(adminState.calls.createUser).toHaveLength(1);
    const profile = dbState.calls.profileCreate[0].data as Record<string, unknown>;
    expect(profile).toMatchObject({ tenantId: "t1", role: "owner", name: "Aya" });
    expect(dbState.calls.auditCreate[0].data).toMatchObject({ action: "owner_created" });
  });

  it("supprime le compte Auth au mieux si l'écriture du Profile échoue", async () => {
    dbState.existingOwner = null;
    dbState.transactionThrows = true;
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result.ok).toBe(false);
    expect(adminState.calls.deleteUser).toEqual(["owner-new-id"]);
  });

  it("renvoie un message parlant si l'email est déjà utilisé", async () => {
    dbState.existingOwner = null;
    adminState.createUserError = { message: "User already registered" };
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result).toEqual({ ok: false, error: "Cette adresse email est déjà utilisée." });
  });
});
