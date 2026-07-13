import { describe, it, expect } from "vitest";
import { resolveZone, isPathAllowedForZone } from "@/lib/proxy/zones";

describe("resolveZone — dev (localhost, path-prefixed)", () => {
  it("treats the root as storefront", () => {
    expect(resolveZone("localhost:3000", "/")).toEqual({ zone: "storefront", rewrittenPathname: "/" });
  });

  it("strips /admin and resolves the dashboard zone", () => {
    expect(resolveZone("localhost:3000", "/admin/commandes")).toEqual({
      zone: "dashboard",
      rewrittenPathname: "/commandes",
    });
  });

  it("defaults bare /admin to /pos", () => {
    expect(resolveZone("localhost:3000", "/admin")).toEqual({ zone: "dashboard", rewrittenPathname: "/pos" });
  });

  it("strips /platform and resolves the admin zone", () => {
    expect(resolveZone("localhost:3000", "/platform/boutiques")).toEqual({
      zone: "admin",
      rewrittenPathname: "/boutiques",
    });
  });
});

describe("resolveZone — prod (host-based)", () => {
  it("resolves the dashboard zone from the admin. subdomain, path untouched", () => {
    expect(resolveZone("admin.foulard-teranga.com", "/commandes")).toEqual({
      zone: "dashboard",
      rewrittenPathname: "/commandes",
    });
  });

  it("resolves the admin zone from the platform. subdomain", () => {
    expect(resolveZone("platform.foulard-teranga.com", "/boutiques")).toEqual({
      zone: "admin",
      rewrittenPathname: "/boutiques",
    });
  });

  it("resolves the storefront zone for any other host", () => {
    expect(resolveZone("foulard-teranga.plateforme.app", "/catalogue")).toEqual({
      zone: "storefront",
      rewrittenPathname: "/catalogue",
    });
  });

  it("defaults the bare root of the admin. subdomain to /pos", () => {
    expect(resolveZone("admin.foulard-teranga.com", "/")).toEqual({
      zone: "dashboard",
      rewrittenPathname: "/pos",
    });
  });

  it("defaults the bare root of the platform. subdomain to /boutiques", () => {
    expect(resolveZone("platform.foulard-teranga.com", "/")).toEqual({
      zone: "admin",
      rewrittenPathname: "/boutiques",
    });
  });
});

describe("isPathAllowedForZone", () => {
  it("allows dashboard paths in the dashboard zone", () => {
    expect(isPathAllowedForZone("dashboard", "/pos")).toBe(true);
  });

  it("rejects a storefront path in the dashboard zone", () => {
    expect(isPathAllowedForZone("dashboard", "/catalogue")).toBe(false);
  });

  it("allows storefront paths in the storefront zone", () => {
    expect(isPathAllowedForZone("storefront", "/catalogue")).toBe(true);
  });

  it("rejects a dashboard path in the storefront zone", () => {
    expect(isPathAllowedForZone("storefront", "/pos")).toBe(false);
  });

  it("allows admin paths in the admin zone", () => {
    expect(isPathAllowedForZone("admin", "/boutiques")).toBe(true);
  });

  it("allows the login path in the dashboard zone", () => {
    expect(isPathAllowedForZone("dashboard", "/connexion")).toBe(true);
  });
});
