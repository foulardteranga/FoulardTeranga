import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

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

describe("proxy — statut de boutique : décision de conception du spec §2", () => {
  // Test structurel, pas comportemental. proxy.ts n'importe aujourd'hui aucun
  // module de résolution de tenant : il n'y a donc rien à mocker qui puisse
  // faire échouer un test comportemental si quelqu'un réintroduit la
  // vérification ici (cf. le commentaire dans proxy.ts). On lit le fichier
  // source et on vérifie l'absence d'import ou d'identifiant de
  // résolution/statut de tenant, en ignorant les commentaires (le commentaire
  // de conception cite volontairement `lib/tenant` pour expliquer la
  // décision, ce qui ferait échouer une recherche naïve de sous-chaîne).
  //
  // Si ce test échoue : quelqu'un a remis un accès base de données sur le
  // chemin du proxy (edge) — revalider la décision du spec §2 avant de
  // modifier ce test, ne pas l'ajuster pour le faire passer.
  it("ne réintroduit pas de résolution de tenant dans proxy.ts (spec §2)", () => {
    const proxySourcePath = path.resolve(__dirname, "./proxy.ts");
    const rawSource = readFileSync(proxySourcePath, "utf8");

    const withoutLineComments = rawSource.replace(/\/\/.*$/gm, "");
    const withoutComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, "");

    const forbiddenPatterns = [
      /from\s+["'][^"']*lib\/tenant[^"']*["']/,
      /\bgetCurrentTenant\b/,
      /\bresolveTenantFromHost\b/,
      /\btenant\.status\b/,
      /\bprisma\.tenant\b/,
    ];

    for (const pattern of forbiddenPatterns) {
      expect(withoutComments).not.toMatch(pattern);
    }
  });
});
