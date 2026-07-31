import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const ctxState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./context", () => ({ resolveActorContext: async () => ctxState.value }));

const tenantState = vi.hoisted(() => ({ shouldThrow: false, status: "active" as string }));
vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => {
    if (tenantState.shouldThrow) {
      throw new Error("Aucune boutique ne correspond à cet hôte.");
    }
    return {
      id: "t1",
      slug: "foulard-teranga",
      name: "Foulard Teranga",
      status: tenantState.status,
      theme: {},
      domains: [],
    };
  },
}));

import { requireWritableSession, READ_ONLY_ERROR, TENANT_NOT_ACTIVE_ERROR } from "./guards";

describe("requireWritableSession", () => {
  it("refuse quand aucune session n'est résolue", async () => {
    ctxState.value = null;
    expect(await requireWritableSession()).toEqual({ ok: false, error: READ_ONLY_ERROR });
  });

  it("refuse en mode lecture seule", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "read", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toEqual({ ok: false, error: READ_ONLY_ERROR });
  });

  it("autorise en mode intervention (write)", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "write", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toEqual({ ok: true });
  });

  it("refuse en mode intervention (write) si le tenantId de l'impersonation ne correspond pas à la boutique courante", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "autre-tenant", role: "owner", permissions: [] },
      impersonation: {
        targetProfileId: "p1",
        tenantId: "autre-tenant",
        mode: "write",
        startedAt: new Date().toISOString(),
      },
    };
    expect(await requireWritableSession()).toEqual({ ok: false, error: READ_ONLY_ERROR });
  });

  it("autorise hors impersonation (usage normal owner/staff/super_admin)", async () => {
    ctxState.value = {
      actor: { userId: "o1", name: "Awa", role: "owner" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: null,
    };
    expect(await requireWritableSession()).toEqual({ ok: true });
  });

  it("expose un message d'erreur explicite invitant à activer le mode intervention", () => {
    expect(READ_ONLY_ERROR).toMatch(/mode intervention/i);
  });

  it("refuse (fail closed) en mode intervention (write) si getCurrentTenant() échoue (hôte non résolu)", async () => {
    tenantState.shouldThrow = true;
    try {
      ctxState.value = {
        actor: { userId: "s1", name: "P", role: "super_admin" },
        effective: { tenantId: "t1", role: "owner", permissions: [] },
        impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "write", startedAt: new Date().toISOString() },
      };
      await expect(requireWritableSession()).resolves.toEqual({ ok: false, error: READ_ONLY_ERROR });
    } finally {
      tenantState.shouldThrow = false;
    }
  });
});

describe("requireWritableSession — boutique suspendue/archivée", () => {
  afterEach(() => {
    tenantState.status = "active";
  });

  it("refuse l'écriture sur une boutique suspendue, avec un message distinct du mode lecture seule", async () => {
    tenantState.status = "suspended";
    ctxState.value = {
      actor: { userId: "o1", name: "Awa", role: "owner" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: null,
    };
    const result = await requireWritableSession();
    expect(result).toEqual({ ok: false, error: TENANT_NOT_ACTIVE_ERROR });
  });

  it("refuse l'écriture sur une boutique archivée", async () => {
    tenantState.status = "archived";
    ctxState.value = {
      actor: { userId: "o1", name: "Awa", role: "owner" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: null,
    };
    const result = await requireWritableSession();
    expect(result.ok).toBe(false);
  });

  it("autorise l'écriture sur une boutique active, hors impersonation", async () => {
    tenantState.status = "active";
    ctxState.value = {
      actor: { userId: "o1", name: "Awa", role: "owner" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: null,
    };
    const result = await requireWritableSession();
    expect(result).toEqual({ ok: true });
  });

  it("garde le message existant en mode lecture seule d'impersonation, même sur une boutique active", async () => {
    tenantState.status = "active";
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "read", startedAt: new Date().toISOString() },
    };
    const result = await requireWritableSession();
    expect(result).toEqual({ ok: false, error: READ_ONLY_ERROR });
  });

  it("le refus « boutique non active » s'applique aussi en mode intervention (write)", async () => {
    tenantState.status = "suspended";
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "write", startedAt: new Date().toISOString() },
    };
    const result = await requireWritableSession();
    expect(result).toEqual({ ok: false, error: TENANT_NOT_ACTIVE_ERROR });
  });
});
