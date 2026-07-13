import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRoleAllowedForZone, resolveSession } from "@/lib/auth";

function fakeSupabase(
  user: { id: string } | null,
  profile: { role: string; name: string } | null
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
    const session = await resolveSession(
      fakeSupabase({ id: "u1" }, { role: "owner", name: "Aïcha Koné" })
    );
    expect(session).toEqual({ userId: "u1", name: "Aïcha Koné", role: "owner" });
  });
});
