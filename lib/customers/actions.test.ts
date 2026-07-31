import { describe, expect, it, vi, beforeEach } from "vitest";

// signUpCustomer est l'inscription publique de la vitrine (visiteuse anonyme,
// pas de session) : ce test ne couvre que son refus sur une boutique non
// active, avant toute écriture — même idiome que lib/orders/actions.test.ts
// (Tâche 17) et lib/auth/actions.test.ts (vi.hoisted pour l'état partagé,
// accessible depuis les factories vi.mock elles-mêmes hoistées).
const tenantState = vi.hoisted(() => ({ status: "active" as string }));
vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => ({
    id: "t1",
    slug: "foulard-teranga",
    name: "Foulard Teranga",
    status: tenantState.status,
    theme: {},
    domains: [],
  }),
}));

const signUp = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { user: { id: "u1" }, session: { access_token: "x" } },
    error: null,
  }))
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp } }),
}));

const dbCalls = vi.hoisted(() => ({
  profileCreate: vi.fn(async () => ({})),
  customerFindMany: vi.fn(async () => [] as Array<{ id: string; phone: string }>),
  customerCreate: vi.fn(async () => ({})),
  customerUpdate: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    profile: { create: dbCalls.profileCreate },
    customer: {
      findMany: dbCalls.customerFindMany,
      create: dbCalls.customerCreate,
      update: dbCalls.customerUpdate,
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() ne doit pas être appelé dans ces cas de refus");
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { signUpCustomer } = await import("@/lib/customers/actions");

function formData(): FormData {
  const fd = new FormData();
  fd.set("name", "Awa Diop");
  fd.set("phone", "0102030405");
  fd.set("place", "Cocody");
  fd.set("email", "awa@example.com");
  fd.set("password", "motdepasse");
  return fd;
}

beforeEach(() => {
  tenantState.status = "active";
  signUp.mockClear();
  dbCalls.profileCreate.mockClear();
  dbCalls.customerFindMany.mockClear();
  dbCalls.customerCreate.mockClear();
  dbCalls.customerUpdate.mockClear();
});

describe("signUpCustomer — boutique suspendue/archivée", () => {
  it("refuse l'inscription avec un message client neutre quand la boutique est suspendue, sans écrire en base", async () => {
    tenantState.status = "suspended";
    const result = await signUpCustomer(null, formData());
    expect(result).toEqual({
      ok: false,
      errors: {},
      formError: "Cette boutique n'accepte plus de nouvelles inscriptions pour le moment.",
    });
    expect(dbCalls.profileCreate).not.toHaveBeenCalled();
    expect(dbCalls.customerCreate).not.toHaveBeenCalled();
    expect(dbCalls.customerUpdate).not.toHaveBeenCalled();
  });

  it("refuse l'inscription quand la boutique est archivée, sans écrire en base", async () => {
    tenantState.status = "archived";
    const result = await signUpCustomer(null, formData());
    expect(result?.ok).toBe(false);
    expect(dbCalls.profileCreate).not.toHaveBeenCalled();
  });
});
