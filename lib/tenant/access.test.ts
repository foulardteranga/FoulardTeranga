import { describe, it, expect, vi, beforeEach } from "vitest";

const tenantState = vi.hoisted(() => ({
  current: null as null | { id: string; slug: string; name: string; status: string },
}));

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);

vi.mock("next/navigation", () => ({ notFound }));

vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-tenant-host", "localhost"]]),
}));

vi.mock("@/lib/tenant/registry", () => ({
  TENANTS_CACHE_TAG: "tenants",
  resolveTenantFromHost: async () => tenantState.current,
}));

const { requireActiveStorefrontTenant } = await import("@/lib/tenant");

beforeEach(() => {
  notFound.mockClear();
  tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "active" };
});

describe("requireActiveStorefrontTenant", () => {
  it("renvoie la boutique quand elle est active", async () => {
    const tenant = await requireActiveStorefrontTenant();
    expect(tenant.id).toBe("t1");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("coupe le rendu quand aucune boutique ne correspond à l'hôte", async () => {
    tenantState.current = null;
    await expect(requireActiveStorefrontTenant()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("coupe le rendu — donc les requêtes de la page — quand la boutique est suspendue", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "suspended" };
    await expect(requireActiveStorefrontTenant()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("coupe le rendu quand la boutique est archivée", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "archived" };
    await expect(requireActiveStorefrontTenant()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
