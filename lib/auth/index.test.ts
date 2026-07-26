import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRoleAllowedForZone, resolveSession, hasModuleAccess, type Session } from "@/lib/auth";

function fakeSupabase(
  user: { id: string } | null,
  profile: {
    role: string;
    name: string;
    active?: boolean;
    tenantId?: string | null;
    employeeRole?: { permissions: string[] } | null;
    tenant?: { enabledModules: string[] } | null;
  } | null
): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const ALL_MODULES = ["pos", "dash", "orders", "inv", "cust", "mkt", "fin", "theme", "vitrine", "boutique"];

function session(over: Partial<Session> = {}): Session {
  return {
    userId: "u1",
    name: "N",
    role: "owner",
    tenantId: "t1",
    permissions: [],
    enabledModules: ALL_MODULES,
    ...over,
  };
}

describe("isRoleAllowedForZone", () => {
  it("always allows the public storefront zone, even with no role", () => {
    expect(isRoleAllowedForZone("storefront", null)).toBe(true);
  });

  it("allows owner and staff into the dashboard zone", () => {
    expect(isRoleAllowedForZone("dashboard", "owner")).toBe(true);
    expect(isRoleAllowedForZone("dashboard", "staff")).toBe(true);
  });

  it("rejects customer and super_admin from the dashboard zone", () => {
    expect(isRoleAllowedForZone("dashboard", "customer")).toBe(false);
    expect(isRoleAllowedForZone("dashboard", "super_admin")).toBe(false);
  });

  it("only allows super_admin into the admin zone", () => {
    expect(isRoleAllowedForZone("admin", "super_admin")).toBe(true);
    expect(isRoleAllowedForZone("admin", "owner")).toBe(false);
  });

  it("rejects a null role from any privileged zone", () => {
    expect(isRoleAllowedForZone("dashboard", null)).toBe(false);
    expect(isRoleAllowedForZone("admin", null)).toBe(false);
  });
});

describe("hasModuleAccess", () => {
  it("accorde à owner tous les modules activés pour sa boutique", () => {
    const owner = session();
    expect(hasModuleAccess(owner, "fin")).toBe(true);
    expect(hasModuleAccess(owner, "pos")).toBe(true);
  });

  it("refuse à owner un module désactivé pour sa boutique", () => {
    const owner = session({ enabledModules: ["pos", "dash"] });
    expect(hasModuleAccess(owner, "fin")).toBe(false);
  });

  it("refuse à owner un identifiant hors MODULE_IDS comme « equipe »", () => {
    // « equipe » n'est pas un module cochable : il a sa propre garde owner.
    expect(hasModuleAccess(session(), "equipe")).toBe(false);
  });

  it("accorde à staff les seuls modules à la fois activés et dans ses permissions", () => {
    const staff = session({ role: "staff", permissions: ["pos", "orders"] });
    expect(hasModuleAccess(staff, "pos")).toBe(true);
    expect(hasModuleAccess(staff, "fin")).toBe(false);
  });

  it("refuse à staff un module permis mais désactivé pour la boutique", () => {
    const staff = session({ role: "staff", permissions: ["fin"], enabledModules: ["pos", "dash"] });
    expect(hasModuleAccess(staff, "fin")).toBe(false);
  });

  it("refuse les sessions customer et nulles", () => {
    expect(hasModuleAccess(null, "pos")).toBe(false);
    expect(hasModuleAccess(session({ role: "customer" }), "pos")).toBe(false);
  });

  it("refuse tout à un compte plateforme, qui ne travaille pas dans le dashboard", () => {
    const platform = session({ role: "super_admin", tenantId: null, enabledModules: [] });
    expect(hasModuleAccess(platform, "pos")).toBe(false);
  });
});

describe("resolveSession", () => {
  it("returns null when there is no authenticated user", async () => {
    const session = await resolveSession(fakeSupabase(null, null));
    expect(session).toBeNull();
  });

  it("returns null when the authenticated user has no matching Profile row", async () => {
    const session = await resolveSession(fakeSupabase({ id: "u1" }, null));
    expect(session).toBeNull();
  });

  it("returns the session when both the user and its profile exist", async () => {
    const result = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        { role: "owner", name: "Aïcha Koné", tenantId: "t1", tenant: { enabledModules: ["pos", "dash"] } }
      )
    );
    expect(result).toEqual({
      userId: "u1",
      name: "Aïcha Koné",
      role: "owner",
      tenantId: "t1",
      permissions: [],
      enabledModules: ["pos", "dash"],
    });
  });

  it("returns null when the profile has been deactivated", () => {
    return resolveSession(
      fakeSupabase({ id: "u1" }, { role: "staff", name: "Awa", active: false, employeeRole: { permissions: ["pos"] } })
    ).then((session) => expect(session).toBeNull());
  });

  it("loads the staff member's module permissions from their EmployeeRole", async () => {
    const result = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        {
          role: "staff",
          name: "Awa",
          active: true,
          tenantId: "t1",
          employeeRole: { permissions: ["pos", "orders"] },
          tenant: { enabledModules: ["pos", "dash", "orders"] },
        }
      )
    );
    expect(result).toEqual({
      userId: "u1",
      name: "Awa",
      role: "staff",
      tenantId: "t1",
      permissions: ["pos", "orders"],
      enabledModules: ["pos", "dash", "orders"],
    });
  });

  it("defaults staff permissions to an empty array when no EmployeeRole is assigned", async () => {
    const result = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        { role: "staff", name: "Awa", active: true, tenantId: "t1", employeeRole: null, tenant: { enabledModules: ["pos"] } }
      )
    );
    expect(result).toEqual({
      userId: "u1",
      name: "Awa",
      role: "staff",
      tenantId: "t1",
      permissions: [],
      enabledModules: ["pos"],
    });
  });

  it("donne un périmètre vide à un compte plateforme sans boutique", async () => {
    const result = await resolveSession(
      fakeSupabase({ id: "u9" }, { role: "super_admin", name: "Prestataire", tenantId: null, tenant: null })
    );
    expect(result).toEqual({
      userId: "u9",
      name: "Prestataire",
      role: "super_admin",
      tenantId: null,
      permissions: [],
      enabledModules: [],
    });
  });
});
