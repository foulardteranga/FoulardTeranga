import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.IMPERSONATION_COOKIE_SECRET = "test-secret-do-not-use-in-prod";

const cookieJar = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: cookieJar.set,
    delete: cookieJar.delete,
    get: () => (cookieJar.value ? { value: cookieJar.value } : undefined),
  }),
}));

const auditLog = vi.hoisted(() => ({ entries: [] as unknown[] }));
vi.mock("@/lib/platform/audit", () => ({
  recordPlatformAction: async (entry: unknown) => {
    auditLog.entries.push(entry);
  },
}));

const dbState = vi.hoisted(() => ({ profile: null as unknown }));
vi.mock("@/lib/db/client", () => ({ prisma: { profile: { findUnique: async () => dbState.profile } } }));

const actorState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./context", () => ({
  getActorContext: async () => actorState.value,
  resolveActorContext: async () => actorState.value,
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => ({ id: "tenant-1", slug: "foulard-teranga", name: "Foulard Teranga", theme: {}, domains: [] }),
}));

import { startImpersonation, unlockImpersonationWrite, endImpersonation } from "./actions";
import * as cookieModule from "./cookie";

const superAdminActor = { actor: { userId: "super-1", name: "Prestataire", role: "super_admin" as const } };

beforeEach(() => {
  cookieJar.set.mockClear();
  cookieJar.delete.mockClear();
  cookieJar.value = undefined;
  auditLog.entries = [];
  dbState.profile = null;
  actorState.value = null;
});

describe("startImpersonation", () => {
  it("refuse un acteur non super_admin", async () => {
    actorState.value = { actor: { userId: "o1", name: "Awa", role: "owner" } };
    const result = await startImpersonation("target-1");
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });

  it("refuse une cible inexistante, inactive, ou dont la boutique n'est pas active", async () => {
    actorState.value = superAdminActor;
    dbState.profile = null;
    expect(await startImpersonation("ghost")).toEqual({ ok: false, error: "Impossible d'entrer dans cette boutique." });
  });

  it("pose un cookie read, trace impersonation_started, en mode read", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "active" },
    };

    const result = await startImpersonation("target-1");

    expect(result).toEqual({ ok: true });
    expect(cookieJar.set).toHaveBeenCalledWith(
      "ft-impersonation",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" })
    );
    expect(auditLog.entries).toEqual([
      expect.objectContaining({ actorId: "super-1", action: "impersonation_started", tenantId: "tenant-1", targetId: "target-1" }),
    ]);

    const cookieValue = cookieJar.set.mock.calls[0][1] as string;
    const [body] = cookieValue.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    expect(payload.mode).toBe("read");
  });

  it("renvoie une erreur générique plutôt que de lever si la signature du cookie échoue (ex. IMPERSONATION_COOKIE_SECRET manquant en prod)", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "active" },
    };
    const spy = vi.spyOn(cookieModule, "signImpersonationCookie").mockImplementation(() => {
      throw new Error("IMPERSONATION_COOKIE_SECRET est requis en production.");
    });

    const result = await startImpersonation("target-1");

    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
    expect(cookieJar.set).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("startImpersonation — boutique non active", () => {
  it("refuse d'entrer dans une boutique suspendue, sans poser de cookie", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "suspended" },
    };

    const result = await startImpersonation("owner-profile-1");

    expect(result).toEqual({
      ok: false,
      error: "Cette boutique n'est pas active : réactivez-la avant d'y entrer.",
    });
    expect(cookieJar.set).not.toHaveBeenCalled();
  });

  it("refuse d'entrer dans une boutique archivée", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "archived" },
    };

    const result = await startImpersonation("owner-profile-1");

    expect(result.ok).toBe(false);
    expect(cookieJar.set).not.toHaveBeenCalled();
  });
});

describe("unlockImpersonationWrite", () => {
  it("refuse hors impersonation", async () => {
    actorState.value = { ...superAdminActor, impersonation: null };
    expect(await unlockImpersonationWrite()).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });

  it("repose un cookie en mode write et trace impersonation_write_unlocked", async () => {
    actorState.value = {
      ...superAdminActor,
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "read", startedAt: new Date().toISOString() },
    };

    const result = await unlockImpersonationWrite();

    expect(result).toEqual({ ok: true });
    expect(auditLog.entries).toEqual([
      expect.objectContaining({ actorId: "super-1", action: "impersonation_write_unlocked", tenantId: "tenant-1", targetId: "target-1" }),
    ]);
  });

  it("préserve le startedAt d'origine dans le cookie re-signé (l'expiration dure ne doit jamais s'étendre)", async () => {
    const originalStartedAt = new Date().toISOString();
    actorState.value = {
      ...superAdminActor,
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "read", startedAt: originalStartedAt },
    };

    await unlockImpersonationWrite();

    const cookieValue = cookieJar.set.mock.calls[0][1] as string;
    const [body] = cookieValue.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    expect(payload.startedAt).toBe(originalStartedAt);
    expect(payload.mode).toBe("write");
  });
});

describe("endImpersonation", () => {
  it("efface le cookie et trace impersonation_ended si une impersonation était active", async () => {
    actorState.value = {
      ...superAdminActor,
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "write", startedAt: new Date().toISOString() },
    };

    const result = await endImpersonation();

    expect(result).toEqual({ ok: true });
    expect(cookieJar.delete).toHaveBeenCalledWith("ft-impersonation");
    expect(auditLog.entries).toEqual([
      expect.objectContaining({ actorId: "super-1", action: "impersonation_ended", tenantId: "tenant-1", targetId: "target-1" }),
    ]);
  });

  it("efface le cookie sans tracer si aucune impersonation n'était active", async () => {
    actorState.value = { ...superAdminActor, impersonation: null };
    const result = await endImpersonation();
    expect(result).toEqual({ ok: true });
    expect(cookieJar.delete).toHaveBeenCalledWith("ft-impersonation");
    expect(auditLog.entries).toEqual([]);
  });
});

import { requireWritableSession } from "./guards";

describe("séquence complète : entrer → refus en lecture → intervention → écriture acceptée → sortie", () => {
  it("mode read refuse l'écriture, mode write l'autorise, sortie efface tout", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "active" },
    };

    await startImpersonation("target-1");
    const signedCookie = cookieJar.set.mock.calls[0][1] as string;
    cookieJar.value = signedCookie;

    actorState.value = {
      actor: { userId: "super-1", name: "Prestataire", role: "super_admin" },
      effective: { tenantId: "tenant-1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "read", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toBe(false);

    await unlockImpersonationWrite();
    const writeCookie = cookieJar.set.mock.calls[1][1] as string;
    cookieJar.value = writeCookie;
    actorState.value = {
      ...(actorState.value as Record<string, unknown>),
      impersonation: { ...((actorState.value as { impersonation: object }).impersonation), mode: "write" },
    };
    expect(await requireWritableSession()).toBe(true);

    await endImpersonation();
    expect(cookieJar.delete).toHaveBeenCalledWith("ft-impersonation");
  });
});
