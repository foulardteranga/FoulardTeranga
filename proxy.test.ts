import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  createMiddlewareClient: () => ({}) as never,
}));

const identityState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/impersonation/context", () => ({
  resolveRequestIdentity: async () => identityState.value,
}));

import { proxy } from "./proxy";

function makeRequest(pathname: string, host = "localhost:3000") {
  return new NextRequest(new URL(pathname, `http://${host}`), {
    headers: { host },
  });
}

const superAdminActor = { userId: "super-1", name: "Prestataire", role: "super_admin" as const };
const ownerActor = { userId: "owner-1", name: "Awa", role: "owner" as const };

const targetOwnerSession = {
  userId: "target-1",
  name: "Fatou",
  role: "owner" as const,
  tenantId: "tenant-1",
  permissions: [],
  enabledModules: ["pos", "dash", "orders", "inv", "cust", "mkt", "fin", "theme", "vitrine", "boutique"],
};

const superAdminSession = {
  userId: "super-1",
  name: "Prestataire",
  role: "super_admin" as const,
  tenantId: null,
  permissions: [],
  enabledModules: [],
};

const ownerSelfSession = {
  userId: "owner-1",
  name: "Awa",
  role: "owner" as const,
  tenantId: "tenant-1",
  permissions: [],
  enabledModules: ["pos", "dash", "orders", "inv", "cust", "mkt", "fin", "theme", "vitrine", "boutique"],
};

beforeEach(() => {
  identityState.value = null;
});

function isRedirectTo(response: Response, path: string): boolean {
  const location = response.headers.get("location");
  return response.status >= 300 && response.status < 400 && !!location && new URL(location).pathname.startsWith(path);
}

describe("proxy — zone gating pendant l'impersonation", () => {
  it("laisse un super_admin en cours d'impersonation (identité effective owner) accéder à la zone dashboard", async () => {
    identityState.value = {
      actor: superAdminActor,
      session: targetOwnerSession,
      impersonation: {
        targetProfileId: "target-1",
        tenantId: "tenant-1",
        mode: "read",
        startedAt: new Date().toISOString(),
      },
    };

    const response = await proxy(makeRequest("/admin/pos"));

    expect(isRedirectTo(response, "/admin/connexion")).toBe(false);
    expect(response.headers.get("x-middleware-rewrite")).toBeTruthy();
  });

  it("laisse un super_admin en cours d'impersonation atteindre la zone plateforme (acteur réel, pas l'identité effective)", async () => {
    identityState.value = {
      actor: superAdminActor,
      session: targetOwnerSession,
      impersonation: {
        targetProfileId: "target-1",
        tenantId: "tenant-1",
        mode: "read",
        startedAt: new Date().toISOString(),
      },
    };

    const response = await proxy(makeRequest("/platform/boutiques"));

    expect(isRedirectTo(response, "/platform/connexion")).toBe(false);
    expect(response.headers.get("x-middleware-rewrite")).toBeTruthy();
  });
});

describe("proxy — contrôle d'accès par module pendant l'impersonation", () => {
  it("bloque un super_admin en impersonation sur un module désactivé pour la cible (fin absent de enabledModules), même si l'acteur est super_admin", async () => {
    const restrictedTargetSession = {
      userId: "target-1",
      name: "Fatou",
      role: "owner" as const,
      tenantId: "tenant-1",
      permissions: [],
      enabledModules: ["pos", "dash"],
    };
    identityState.value = {
      actor: superAdminActor,
      session: restrictedTargetSession,
      impersonation: {
        targetProfileId: "target-1",
        tenantId: "tenant-1",
        mode: "read",
        startedAt: new Date().toISOString(),
      },
    };

    const response = await proxy(makeRequest("/admin/finance"));

    // Ne doit pas atteindre /finance : le module "fin" n'est pas dans la
    // liste effective (celle de la cible), même si l'acteur réel est
    // super_admin. Une régression qui ferait retomber `hasModuleAccess` sur
    // la session de l'acteur laisserait ce cas passer (rewrite au lieu
    // d'une redirection).
    expect(response.headers.get("x-middleware-rewrite")).toBeFalsy();
    expect(isRedirectTo(response, "/admin/finance")).toBe(false);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location!).pathname.startsWith("/admin/finance")).toBe(false);
  });
});

describe("proxy — comportement normal, sans impersonation (régression)", () => {
  it("laisse un owner normal accéder à la zone dashboard", async () => {
    identityState.value = { actor: ownerActor, session: ownerSelfSession, impersonation: null };

    const response = await proxy(makeRequest("/admin/pos"));

    expect(isRedirectTo(response, "/admin/connexion")).toBe(false);
    expect(response.headers.get("x-middleware-rewrite")).toBeTruthy();
  });

  it("refuse un owner normal sur la zone plateforme", async () => {
    identityState.value = { actor: ownerActor, session: ownerSelfSession, impersonation: null };

    const response = await proxy(makeRequest("/platform/boutiques"));

    expect(isRedirectTo(response, "/platform/connexion")).toBe(true);
  });

  it("laisse un super_admin normal (hors impersonation) accéder à la zone plateforme", async () => {
    identityState.value = { actor: superAdminActor, session: superAdminSession, impersonation: null };

    const response = await proxy(makeRequest("/platform/boutiques"));

    expect(isRedirectTo(response, "/platform/connexion")).toBe(false);
    expect(response.headers.get("x-middleware-rewrite")).toBeTruthy();
  });

  it("refuse un super_admin normal (hors impersonation) sur la zone dashboard", async () => {
    identityState.value = { actor: superAdminActor, session: superAdminSession, impersonation: null };

    const response = await proxy(makeRequest("/admin/pos"));

    expect(isRedirectTo(response, "/admin/connexion")).toBe(true);
  });
});
