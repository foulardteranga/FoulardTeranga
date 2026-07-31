import { describe, it, expect, vi, beforeEach } from "vitest";

// État partagé, déclaré via vi.hoisted pour rester accessible depuis les
// factories vi.mock (elles-mêmes hoistées au-dessus des imports) — même idiome
// que lib/platform/actions.test.ts et lib/platform/lifecycle.test.ts.
const tenantState = vi.hoisted(() => ({
  current: { id: "t1", slug: "boutique", name: "Boutique", status: "active" } as {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null,
}));

const signInWithPassword = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantOrNull: async () => tenantState.current,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword, signOut: vi.fn() } }),
}));

// `signIn` importe aussi `@/lib/impersonation/context` et `@/lib/platform/audit`,
// qui remontent tous deux jusqu'à `@/lib/db/client` (Prisma réel). Mockés ici
// pour la même raison que dans lib/auth/index.test.ts et
// lib/platform/actions.test.ts : ces chemins ne sont pas exercés par les
// refus testés ci-dessous, mais l'IMPORT du module suffit à les charger.
vi.mock("@/lib/impersonation/context", () => ({
  getActorContext: async () => null,
}));

vi.mock("@/lib/platform/audit", () => ({
  recordPlatformAction: vi.fn(async () => {}),
}));

const { signIn } = await import("@/lib/auth/actions");

function formData(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

beforeEach(() => {
  tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "active" };
  signInWithPassword.mockClear();
});

describe("signIn — application de la suspension", () => {
  it("refuse la connexion sur une boutique suspendue, sans appeler Supabase", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "suspended" };
    const result = await signIn(null, formData("aya@example.com", "motdepasse"));
    expect(result?.formError).toBe("L'accès à cette boutique est suspendu. Contactez votre prestataire.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuse la connexion sur une boutique archivée", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "archived" };
    const result = await signIn(null, formData("aya@example.com", "motdepasse"));
    expect(result?.formError).toBe("L'accès à cette boutique est suspendu. Contactez votre prestataire.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
