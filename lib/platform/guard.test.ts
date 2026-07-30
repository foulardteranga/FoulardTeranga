import { describe, expect, it, vi, beforeEach } from "vitest";

const ctxState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/impersonation/context", () => ({ getActorContext: async () => ctxState.value }));

import { currentSuperAdmin, requireSuperAdmin } from "./guard";

beforeEach(() => {
  ctxState.value = null;
});

describe("currentSuperAdmin", () => {
  it("renvoie null si l'appelant n'est pas super_admin", async () => {
    ctxState.value = {
      actor: { userId: "owner-1", name: "Awa", role: "owner" },
      effective: { tenantId: "tenant-1", role: "owner", permissions: [] },
      impersonation: null,
    };
    expect(await currentSuperAdmin()).toBeNull();
  });

  it("renvoie null si aucun contexte n'est résolu", async () => {
    ctxState.value = null;
    expect(await currentSuperAdmin()).toBeNull();
  });

  it("renvoie la session plateforme pour un super_admin hors impersonation", async () => {
    ctxState.value = {
      actor: { userId: "super-1", name: "Prestataire", role: "super_admin" },
      effective: { tenantId: null, role: "super_admin", permissions: [] },
      impersonation: null,
    };
    expect(await currentSuperAdmin()).toEqual({
      userId: "super-1",
      name: "Prestataire",
      role: "super_admin",
      tenantId: null,
      permissions: [],
      enabledModules: [],
    });
  });

  it("reste basé sur l'acteur RÉEL en cours d'impersonation, pas l'identité effective (owner cible)", async () => {
    ctxState.value = {
      actor: { userId: "super-1", name: "Prestataire", role: "super_admin" },
      effective: { tenantId: "tenant-1", role: "owner", permissions: [] },
      impersonation: {
        targetProfileId: "target-1",
        tenantId: "tenant-1",
        mode: "read",
        startedAt: new Date().toISOString(),
      },
    };
    expect(await currentSuperAdmin()).toEqual({
      userId: "super-1",
      name: "Prestataire",
      role: "super_admin",
      tenantId: null,
      permissions: [],
      enabledModules: [],
    });
  });
});

describe("requireSuperAdmin", () => {
  it("lève si l'appelant n'est pas super_admin", async () => {
    ctxState.value = null;
    await expect(requireSuperAdmin()).rejects.toThrow("Accès plateforme refusé.");
  });

  it("renvoie la session pour un super_admin", async () => {
    ctxState.value = {
      actor: { userId: "super-1", name: "Prestataire", role: "super_admin" },
      effective: { tenantId: null, role: "super_admin", permissions: [] },
      impersonation: null,
    };
    expect((await requireSuperAdmin()).role).toBe("super_admin");
  });
});
