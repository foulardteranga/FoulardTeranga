import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.IMPERSONATION_COOKIE_SECRET = "test-secret-do-not-use-in-prod";

const cookieStore = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "ft-impersonation" && cookieStore.value ? { value: cookieStore.value } : undefined),
  }),
}));

const dbState = vi.hoisted(() => ({ profile: null as unknown }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    profile: {
      findUnique: async () => dbState.profile,
    },
  },
}));

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return { ...actual, resolveSession: vi.fn() };
});

import { resolveSession } from "@/lib/auth/session";
import { signImpersonationCookie } from "./cookie";
import { resolveActorContext, resolveRequestIdentity } from "./context";

const mockedResolveSession = vi.mocked(resolveSession);

beforeEach(() => {
  cookieStore.value = undefined;
  dbState.profile = null;
  mockedResolveSession.mockReset();
});

const superAdminSession = {
  userId: "super-1",
  name: "Prestataire",
  role: "super_admin" as const,
  tenantId: null,
  permissions: [],
  enabledModules: [],
};

const ownerSession = {
  userId: "owner-1",
  name: "Awa",
  role: "owner" as const,
  tenantId: "tenant-1",
  permissions: [],
  enabledModules: ["dash", "pos"],
};

const validTarget = {
  id: "target-owner-1",
  name: "Fatou",
  role: "owner",
  active: true,
  tenantId: "tenant-1",
  employeeRole: null,
  tenant: { id: "tenant-1", status: "active", enabledModules: ["dash", "pos", "cust"] },
};

describe("resolveActorContext — le test anti-escalade le plus important du lot (spec §12)", () => {
  it("ignore purement et simplement le cookie si l'acteur n'est pas super_admin", async () => {
    mockedResolveSession.mockResolvedValue(ownerSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "write",
      actorUserId: "owner-1", // même si l'attaquant forge un cookie qui se désigne lui-même comme acteur
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.actor.role).toBe("owner");
    expect(ctx?.impersonation).toBeNull();
    expect(ctx?.effective).toEqual({ tenantId: "tenant-1", role: "owner", permissions: [] });
  });

  it("cookie valide → effective = la cible, actor préservé", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.actor).toEqual({ userId: "super-1", name: "Prestataire", role: "super_admin" });
    expect(ctx?.effective).toEqual({ tenantId: "tenant-1", role: "owner", permissions: [] });
    expect(ctx?.impersonation).toMatchObject({ targetProfileId: "target-owner-1", tenantId: "tenant-1", mode: "read" });
  });

  it("cookie expiré → impersonation abandonnée", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // il y a 2h
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
    expect(ctx?.effective.role).toBe("super_admin");
  });

  it("actorUserId non concordant → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "another-super-admin",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("signature invalide / cookie forgé → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = "not-a-valid-cookie.at-all";
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("cible inactive → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = { ...validTarget, active: false };

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("boutique cible suspendue/archivée → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = { ...validTarget, tenant: { ...validTarget.tenant, status: "suspended" } };

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("aucune session → null", async () => {
    mockedResolveSession.mockResolvedValue(null);
    const ctx = await resolveActorContext({} as never);
    expect(ctx).toBeNull();
  });
});

describe("resolveRequestIdentity — variante proxy.ts (cookie brut, pas next/headers)", () => {
  it("ignore le cookie fourni si l'acteur n'est pas super_admin", async () => {
    mockedResolveSession.mockResolvedValue(ownerSession);
    const raw = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "write",
      actorUserId: "owner-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const identity = await resolveRequestIdentity({} as never, raw);

    expect(identity?.actor.role).toBe("owner");
    expect(identity?.impersonation).toBeNull();
    expect(identity?.session.role).toBe("owner");
  });

  it("super_admin + cookie valide → actor.role super_admin ET session.role = celui de la cible", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    const raw = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const identity = await resolveRequestIdentity({} as never, raw);

    expect(identity?.actor.role).toBe("super_admin");
    expect(identity?.session.role).toBe("owner");
    expect(identity?.impersonation).toMatchObject({ targetProfileId: "target-owner-1", mode: "read" });
  });
});
