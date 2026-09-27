import { describe, it, expect, vi, beforeEach } from "vitest";

const headerMap = vi.hoisted(() => new Map<string, string>());
const resolveMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: async () => headerMap,
}));

vi.mock("@/lib/tenant/registry", () => ({
  TENANTS_CACHE_TAG: "tenants",
  resolveTenantFromHost: resolveMock,
}));

import { getCurrentTenantOrNull, getCurrentTenant } from "./index";

describe("getCurrentTenantOrNull & getCurrentTenant", () => {
  beforeEach(() => {
    headerMap.clear();
    resolveMock.mockReset();
  });

  it("utilise x-tenant-host en priorité lorsqu'il est présent", async () => {
    headerMap.set("x-tenant-host", "custom-rewrite.app");
    headerMap.set("x-forwarded-host", "forwarded.app");
    headerMap.set("host", "direct.app");

    resolveMock.mockResolvedValueOnce({
      id: "t1",
      slug: "boutique",
      name: "Boutique",
      status: "active",
      domains: [],
      theme: {},
    });

    const tenant = await getCurrentTenantOrNull();
    expect(resolveMock).toHaveBeenCalledWith("custom-rewrite.app");
    expect(tenant?.id).toBe("t1");
  });

  it("se replie sur x-forwarded-host lorsque x-tenant-host est absent (ex: Server Actions Vercel)", async () => {
    headerMap.set("x-forwarded-host", "foulard-teranga.vercel.app");
    headerMap.set("host", "direct.internal");

    resolveMock.mockResolvedValueOnce({
      id: "t1",
      slug: "boutique",
      name: "Boutique",
      status: "active",
      domains: ["foulard-teranga.vercel.app"],
      theme: {},
    });

    const tenant = await getCurrentTenantOrNull();
    expect(resolveMock).toHaveBeenCalledWith("foulard-teranga.vercel.app");
    expect(tenant?.id).toBe("t1");
  });

  it("se replie sur host si x-tenant-host et x-forwarded-host sont absents", async () => {
    headerMap.set("host", "foulard-teranga.vercel.app");

    resolveMock.mockResolvedValueOnce({
      id: "t1",
      slug: "boutique",
      name: "Boutique",
      status: "active",
      domains: ["foulard-teranga.vercel.app"],
      theme: {},
    });

    const tenant = await getCurrentTenant();
    expect(resolveMock).toHaveBeenCalledWith("foulard-teranga.vercel.app");
    expect(tenant.id).toBe("t1");
  });

  it("renvoie null et lance une exception dans getCurrentTenant si aucun hôte n'est détecté", async () => {
    const tenant = await getCurrentTenantOrNull();
    expect(tenant).toBeNull();
    expect(resolveMock).not.toHaveBeenCalled();

    await expect(getCurrentTenant()).rejects.toThrow("Aucune boutique ne correspond à cet hôte.");
  });
});
