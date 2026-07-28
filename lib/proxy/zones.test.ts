import { describe, it, expect } from "vitest";
import {
  resolveZone,
  isPathAllowedForZone,
  dashboardPath,
  moduleForPath,
  platformPath,
  ADMIN_PATHS,
} from "@/lib/proxy/zones";

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

describe("dashboardPath", () => {
  it("prefixes with /admin in dev (path-based zone resolution)", () => {
    expect(dashboardPath("localhost:3000", "/connexion")).toBe("/admin/connexion");
  });

  it("stays unprefixed in prod (subdomain-based zone resolution)", () => {
    expect(dashboardPath("admin.foulard-teranga.com", "/connexion")).toBe("/connexion");
  });

  it("prefixes any dashboard path in dev, not just /connexion", () => {
    expect(dashboardPath("localhost:3000", "/pos")).toBe("/admin/pos");
  });
});

describe("moduleForPath", () => {
  it("résout un chemin exact vers son id de module", () => {
    expect(moduleForPath("/finance")).toBe("fin");
  });

  it("résout un sous-chemin vers le même module que son parent", () => {
    expect(moduleForPath("/inventaire/produit-1")).toBe("inv");
  });

  it("retourne null pour un chemin non gaté (équipe, connexion)", () => {
    expect(moduleForPath("/equipe")).toBeNull();
    expect(moduleForPath("/connexion")).toBeNull();
  });
});

describe("platformPath", () => {
  it("préfixe /platform en développement (résolution par chemin)", () => {
    expect(platformPath("localhost:3000", "/connexion")).toBe("/platform/connexion");
  });

  it("laisse le chemin nu en production (résolution par sous-domaine)", () => {
    expect(platformPath("platform.foulard-teranga.com", "/connexion")).toBe("/connexion");
  });

  it("préfixe aussi sur les URLs de prévisualisation Vercel", () => {
    expect(platformPath("mon-app-abc.vercel.app", "/boutiques")).toBe("/platform/boutiques");
  });
});

describe("zone admin — chemins autorisés", () => {
  it("déclare /connexion comme chemin de la zone plateforme", () => {
    expect(ADMIN_PATHS).toContain("/connexion");
  });

  it("autorise /connexion dans la zone admin", () => {
    expect(isPathAllowedForZone("admin", "/connexion")).toBe(true);
  });

  it("autorise la fiche d'une boutique et le formulaire de création", () => {
    expect(isPathAllowedForZone("admin", "/boutiques/nouvelle")).toBe(true);
    expect(isPathAllowedForZone("admin", "/boutiques/foulard-teranga")).toBe(true);
  });

  it("refuse toujours un chemin de dashboard dans la zone admin", () => {
    expect(isPathAllowedForZone("admin", "/pos")).toBe(false);
  });

  it("refuse toujours /connexion et /boutiques en zone storefront", () => {
    expect(isPathAllowedForZone("storefront", "/connexion")).toBe(false);
    expect(isPathAllowedForZone("storefront", "/boutiques")).toBe(false);
  });
});
