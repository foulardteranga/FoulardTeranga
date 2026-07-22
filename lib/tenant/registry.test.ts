import { describe, it, expect } from "vitest";
import { DEFAULT_TENANT, resolveTenantFromHost } from "@/lib/tenant/registry";

describe("resolveTenantFromHost", () => {
  it("resolves the default tenant for localhost", () => {
    expect(resolveTenantFromHost("localhost:3000").id).toBe(DEFAULT_TENANT.id);
  });

  it("resolves by canonical subdomain", () => {
    expect(resolveTenantFromHost("foulard-teranga.plateforme.app").id).toBe(DEFAULT_TENANT.id);
  });

  it("resolves by a registered custom domain", () => {
    expect(resolveTenantFromHost("foulard-teranga.localhost").id).toBe(DEFAULT_TENANT.id);
  });

  it("falls back to the default tenant for an unknown host", () => {
    expect(resolveTenantFromHost("unknown-shop.example.com").id).toBe(DEFAULT_TENANT.id);
  });

  it("is case-insensitive and ignores the port", () => {
    expect(resolveTenantFromHost("FOULARD-TERANGA.PLATEFORME.APP:8080").id).toBe(DEFAULT_TENANT.id);
  });
});
