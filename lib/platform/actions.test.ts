import { describe, it, expect, vi, beforeEach } from "vitest";

// État partagé, déclaré via vi.hoisted pour rester accessible depuis les
// factories vi.mock (elles-mêmes hoistées au-dessus des imports). Par défaut
// tout reste en mode "throw" : les 3 tests de refus existants continuent de
// prouver que la base/Auth ne sont jamais atteints sans la garde super_admin,
// exactement comme avant. Les nouveaux tests "succès" basculent explicitement
// en mode "record" pour obtenir un mock qui capture les appels au lieu de lever.
const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  mode: "throw" as "throw" | "record",
  // Table minimaliste utilisée uniquement par le test « exclusion de soi-même » :
  // permet à findFirst de vraiment filtrer plutôt que de renvoyer une valeur figée.
  tenantsTable: [] as Array<{ id: string; slug: string; name: string }>,
  findUniqueResult: null as null | Record<string, unknown>,
  transactionThrows: false,
  transactionCallCount: 0,
  calls: {
    findFirst: [] as Array<Record<string, unknown>>,
    findUnique: [] as Array<Record<string, unknown>>,
    tenantCreate: [] as Array<Record<string, unknown>>,
    tenantUpdate: [] as Array<Record<string, unknown>>,
    employeeRoleCreateMany: [] as Array<Record<string, unknown>>,
    storefrontPageCreate: [] as Array<Record<string, unknown>>,
    profileCreate: [] as Array<Record<string, unknown>>,
    auditCreate: [] as Array<Record<string, unknown>>,
  },
}));

const adminState = vi.hoisted(() => ({
  mode: "throw" as "throw" | "record",
  createUserId: "owner-new-id",
  createUserError: null as null | { code?: string; message?: string },
  calls: {
    createUser: [] as Array<Record<string, unknown>>,
    deleteUser: [] as string[],
  },
}));

function resetTestState() {
  authState.role = "owner";
  dbState.mode = "throw";
  dbState.tenantsTable = [];
  dbState.findUniqueResult = null;
  dbState.transactionThrows = false;
  dbState.transactionCallCount = 0;
  dbState.calls.findFirst = [];
  dbState.calls.findUnique = [];
  dbState.calls.tenantCreate = [];
  dbState.calls.tenantUpdate = [];
  dbState.calls.employeeRoleCreateMany = [];
  dbState.calls.storefrontPageCreate = [];
  dbState.calls.profileCreate = [];
  dbState.calls.auditCreate = [];
  adminState.mode = "throw";
  adminState.createUserId = "owner-new-id";
  adminState.createUserError = null;
  adminState.calls.createUser = [];
  adminState.calls.deleteUser = [];
  vi.mocked(revalidatePath).mockClear();
}

vi.mock("@/lib/auth", () => ({
  getSession: async () =>
    authState.role === "super_admin"
      ? {
          userId: "admin-1",
          name: "Admin Plateforme",
          role: "super_admin",
          tenantId: null,
          permissions: [],
          enabledModules: [],
        }
      : {
          userId: "u1",
          name: "Aya",
          role: "owner",
          tenantId: "t1",
          permissions: [],
          enabledModules: ["dash"],
        },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    tenant: {
      findFirst: async (args: Record<string, unknown>) => {
        if (dbState.mode === "throw") {
          throw new Error("la base ne doit jamais être atteinte sans garde");
        }
        dbState.calls.findFirst.push(args);
        const where = (args.where ?? {}) as { slug?: string; NOT?: { id?: string } };
        const rows = dbState.tenantsTable.filter(
          (t) =>
            (where.slug === undefined || t.slug === where.slug) &&
            (!where.NOT?.id || t.id !== where.NOT.id)
        );
        return rows[0] ?? null;
      },
      findUnique: async (args: Record<string, unknown>) => {
        if (dbState.mode === "throw") {
          throw new Error("la base ne doit jamais être atteinte sans garde");
        }
        dbState.calls.findUnique.push(args);
        return dbState.findUniqueResult;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      dbState.transactionCallCount += 1;
      if (dbState.mode === "throw") {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      }
      if (dbState.transactionThrows) {
        throw new Error("la transaction a échoué");
      }
      const tx = {
        tenant: {
          create: async (args: Record<string, unknown>) => {
            dbState.calls.tenantCreate.push(args);
            return { id: "tenant-new-id", ...(args.data as Record<string, unknown>) };
          },
          update: async (args: Record<string, unknown>) => {
            dbState.calls.tenantUpdate.push(args);
            return {};
          },
        },
        employeeRole: {
          createMany: async (args: Record<string, unknown>) => {
            dbState.calls.employeeRoleCreateMany.push(args);
            return { count: (args.data as unknown[]).length };
          },
        },
        storefrontPage: {
          create: async (args: Record<string, unknown>) => {
            dbState.calls.storefrontPageCreate.push(args);
            return {};
          },
        },
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
      return fn(tx);
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (adminState.mode === "throw") {
      throw new Error("aucun compte Auth ne doit être créé sans garde");
    }
    return {
      auth: {
        admin: {
          createUser: async (args: Record<string, unknown>) => {
            adminState.calls.createUser.push(args);
            if (adminState.createUserError) {
              return { data: { user: null }, error: adminState.createUserError };
            }
            return { data: { user: { id: adminState.createUserId } }, error: null };
          },
          deleteUser: async (id: string) => {
            adminState.calls.deleteUser.push(id);
            return { data: {}, error: null };
          },
        },
      },
    };
  },
}));

// Next.js exige un store de génération statique pour revalidatePath/updateTag ;
// hors d'une requête réelle (contexte des tests unitaires) ils lèvent — cf.
// vérification manuelle avant d'écrire ces tests. On les neutralise donc ici,
// comme le ferait le runtime Next au moment du rendu.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  // lib/tenant/index.ts (importé transitivement pour TENANTS_CACHE_TAG) enveloppe
  // sa lecture avec unstable_cache ; en dehors d'une requête Next réelle, on se
  // contente de retourner la fonction telle quelle (pas de mise en cache réelle).
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

import { revalidatePath } from "next/cache";
import { createTenant, updateTenantIdentity, updateTenantModules } from "./actions";

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
  beforeEach(resetTestState);

  it("refuse une gérante sans toucher ni à la base ni à Supabase Auth", async () => {
    expect(await createTenant(VALID_INPUT)).toEqual(denied);
  });

  it("crée la boutique, le compte owner et les deux entrées d'audit pour un super_admin", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    adminState.mode = "record";

    const result = await createTenant(VALID_INPUT);

    expect(result).toEqual({ ok: true, slug: "boutique-du-plateau" });

    // Une seule transaction pour tout le provisioning.
    expect(dbState.transactionCallCount).toBe(1);

    // Compte Auth créé avec les bons identifiants.
    expect(adminState.calls.createUser).toHaveLength(1);
    expect(adminState.calls.createUser[0]).toMatchObject({
      email: "aya@example.com",
      password: "motdepasse1",
      email_confirm: true,
    });

    // Tenant créé avec slug/name/plan/enabledModules dérivés de modulesForPlan("essentiel").
    expect(dbState.calls.tenantCreate).toHaveLength(1);
    const tenantCreateData = dbState.calls.tenantCreate[0].data as Record<string, unknown>;
    expect(tenantCreateData).toMatchObject({
      slug: "boutique-du-plateau",
      name: "Boutique du Plateau",
      plan: "essentiel",
      enabledModules: ["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"],
    });

    // Deux rôles par défaut pour le palier essentiel (Vendeuse + Gérant adjoint).
    expect(dbState.calls.employeeRoleCreateMany).toHaveLength(1);
    const rolesData = dbState.calls.employeeRoleCreateMany[0].data as Array<Record<string, unknown>>;
    expect(rolesData).toHaveLength(2);
    expect(rolesData.every((role) => role.tenantId === "tenant-new-id")).toBe(true);
    expect(rolesData.map((role) => role.name)).toEqual(["Vendeuse", "Gérant adjoint"]);

    // Page vitrine créée pour le nouveau tenant.
    expect(dbState.calls.storefrontPageCreate).toHaveLength(1);
    const pageData = dbState.calls.storefrontPageCreate[0].data as Record<string, unknown>;
    expect(pageData).toMatchObject({ tenantId: "tenant-new-id", slug: "home" });

    // Profile owner créé avec l'id du compte Auth fraîchement créé.
    expect(dbState.calls.profileCreate).toHaveLength(1);
    const profileData = dbState.calls.profileCreate[0].data as Record<string, unknown>;
    expect(profileData).toMatchObject({
      id: "owner-new-id",
      tenantId: "tenant-new-id",
      role: "owner",
      name: "Aya Koné",
      email: "aya@example.com",
    });

    // Deux entrées d'audit, tracées au nom de l'ACTEUR (super_admin), jamais de la gérante.
    expect(dbState.calls.auditCreate).toHaveLength(2);
    const [tenantCreatedEntry, ownerCreatedEntry] = dbState.calls.auditCreate.map(
      (call) => call.data as Record<string, unknown>
    );
    expect(tenantCreatedEntry).toMatchObject({ actorId: "admin-1", action: "tenant_created", tenantId: "tenant-new-id" });
    expect(ownerCreatedEntry).toMatchObject({
      actorId: "admin-1",
      action: "owner_created",
      tenantId: "tenant-new-id",
      targetId: "owner-new-id",
    });
    expect(tenantCreatedEntry.actorId).not.toBe("owner-new-id");
    expect(ownerCreatedEntry.actorId).not.toBe("owner-new-id");
  });

  it("refuse un slug déjà utilisé sans jamais toucher à Supabase Auth", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.tenantsTable = [{ id: "other-tenant", slug: "boutique-du-plateau", name: "Autre Boutique" }];
    // adminState reste en mode "throw" : si le code atteignait createAdminClient()
    // malgré le conflit de slug, l'appel lèverait et le test échouerait avec
    // GENERIC_ERROR au lieu du message de conflit attendu ci-dessous.

    const result = await createTenant(VALID_INPUT);

    expect(result).toEqual({ ok: false, error: "Ce slug est déjà utilisé." });
    expect(adminState.calls.createUser).toHaveLength(0);
    expect(dbState.transactionCallCount).toBe(0);
  });

  it("refuse un email déjà utilisé sans jamais tenter la transaction", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    adminState.mode = "record";
    adminState.createUserError = { code: "email_exists", message: "already registered" };

    const result = await createTenant(VALID_INPUT);

    expect(result).toEqual({ ok: false, error: "Cet email est déjà utilisé." });
    expect(dbState.transactionCallCount).toBe(0);
  });

  it("annule (rollback) le compte Auth si la transaction échoue", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.transactionThrows = true;
    adminState.mode = "record";
    adminState.createUserId = "orphan-owner-id";

    const result = await createTenant(VALID_INPUT);

    expect(result).toEqual(denied);
    expect(adminState.calls.deleteUser).toEqual(["orphan-owner-id"]);
  });
});

const VALID_IDENTITY_INPUT = {
  name: "Boutique du Plateau",
  slug: "boutique-du-plateau",
  tagline: "",
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "BDP",
  font: "Playfair Display" as const,
  whatsappPhone: "",
  domains: [],
};

describe("updateTenantIdentity — réservée au prestataire", () => {
  beforeEach(resetTestState);

  it("refuse une gérante sans toucher à la base", async () => {
    const result = await updateTenantIdentity("t1", VALID_IDENTITY_INPUT);
    expect(result).toEqual(denied);
  });

  it("met à jour l'identité et écrit une entrée d'audit tenant_updated pour un super_admin", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.findUniqueResult = { slug: "ancien-slug" };

    const result = await updateTenantIdentity("t1", VALID_IDENTITY_INPUT);

    expect(result).toEqual({ ok: true });
    expect(dbState.transactionCallCount).toBe(1);

    expect(dbState.calls.tenantUpdate).toHaveLength(1);
    const updateCall = dbState.calls.tenantUpdate[0];
    expect(updateCall.where).toEqual({ id: "t1" });
    expect(updateCall.data).toMatchObject({
      name: "Boutique du Plateau",
      slug: "boutique-du-plateau",
      tagline: "",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      logoText: "BDP",
      font: "Playfair Display",
      whatsappPhone: null,
      domains: [],
    });

    expect(dbState.calls.auditCreate).toHaveLength(1);
    const auditData = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(auditData).toMatchObject({
      actorId: "admin-1",
      action: "tenant_updated",
      tenantId: "t1",
    });

    // L'ANCIEN slug ("ancien-slug", lu avant la transaction) doit aussi être
    // revalidé après un renommage, sinon sa page publiée reste périmée.
    expect(revalidatePath).toHaveBeenCalledWith("/boutiques/ancien-slug");
    expect(revalidatePath).toHaveBeenCalledWith("/boutiques/boutique-du-plateau");
  });

  it("n'accuse pas un conflit de slug avec la boutique elle-même (exceptTenantId)", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.findUniqueResult = { slug: "boutique-du-plateau" };
    // La boutique possède déjà ce slug : si exceptTenantId n'était pas propagé,
    // findFirst la retrouverait et un conflit avec elle-même serait signalé à tort.
    dbState.tenantsTable = [{ id: "t1", slug: "boutique-du-plateau", name: "Boutique du Plateau" }];

    const result = await updateTenantIdentity("t1", VALID_IDENTITY_INPUT);

    expect(result).toEqual({ ok: true });
    expect(dbState.calls.findFirst).toHaveLength(1);
    expect(dbState.calls.findFirst[0].where).toMatchObject({
      slug: "boutique-du-plateau",
      NOT: { id: "t1" },
    });
  });
});

describe("updateTenantModules — réservée au prestataire", () => {
  beforeEach(resetTestState);

  it("refuse une gérante sans toucher à la base", async () => {
    const result = await updateTenantModules("t1", { plan: "pro", modules: ["dash", "pos"] });
    expect(result).toEqual(denied);
  });

  it("change le plan et les modules, et journalise un before/after distinct", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.findUniqueResult = { slug: "boutique-du-plateau", plan: "essentiel", enabledModules: ["dash", "pos"] };

    const result = await updateTenantModules("t1", { plan: "pro", modules: ["dash", "pos", "mkt"] });

    expect(result).toEqual({ ok: true });
    expect(dbState.transactionCallCount).toBe(1);

    expect(dbState.calls.tenantUpdate).toHaveLength(1);
    expect(dbState.calls.tenantUpdate[0]).toMatchObject({
      where: { id: "t1" },
      data: { plan: "pro", enabledModules: ["dash", "pos", "mkt"] },
    });

    expect(dbState.calls.auditCreate).toHaveLength(1);
    const auditData = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(auditData).toMatchObject({ actorId: "admin-1", action: "modules_changed", tenantId: "t1" });
    const metadata = auditData.metadata as Record<string, unknown>;
    expect(metadata).toEqual({
      planBefore: "essentiel",
      planAfter: "pro",
      modulesBefore: ["dash", "pos"],
      modulesAfter: ["dash", "pos", "mkt"],
    });
    // Les valeurs before/after doivent bien différer (pas un copier-coller de la même référence).
    expect(metadata.planBefore).not.toBe(metadata.planAfter);
    expect(metadata.modulesBefore).not.toEqual(metadata.modulesAfter);
  });

  it("refuse quand la boutique est introuvable, sans tenter de transaction", async () => {
    authState.role = "super_admin";
    dbState.mode = "record";
    dbState.findUniqueResult = null;

    const result = await updateTenantModules("t1", { plan: "pro", modules: ["dash", "pos"] });

    expect(result).toEqual({ ok: false, error: "Boutique introuvable." });
    expect(dbState.transactionCallCount).toBe(0);
  });
});
