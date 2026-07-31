import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: { tenant: { findMany: () => findMany() } },
}));

// unstable_cache exécute simplement la fonction en test : on veut vérifier la
// logique de résolution, pas le comportement de cache de Next.js.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));

const { resolveTenantFromHost } = await import("@/lib/tenant/registry");

const ROWS = [
  {
    id: "foulard-teranga",
    slug: "foulard-teranga",
    name: "Foulard Teranga",
    status: "active",
    primaryColor: "#26326B",
    accentColor: "#D07A34",
    logoText: "Foulard Teranga",
    domains: ["localhost", "foulard-teranga.localhost"],
  },
  {
    id: "boutique-voisine",
    slug: "boutique-voisine",
    name: "Boutique Voisine",
    status: "active",
    primaryColor: "#0E9F6E",
    accentColor: "#C9A227",
    logoText: "Boutique Voisine",
    domains: ["boutique-voisine.ci"],
  },
];

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue(ROWS);
});

describe("resolveTenantFromHost", () => {
  it("résout par sous-domaine canonique", async () => {
    const tenant = await resolveTenantFromHost("foulard-teranga.plateforme.app");
    expect(tenant?.id).toBe("foulard-teranga");
  });

  it("résout par domaine personnalisé enregistré", async () => {
    const tenant = await resolveTenantFromHost("boutique-voisine.ci");
    expect(tenant?.id).toBe("boutique-voisine");
  });

  it("résout localhost vers la boutique qui le déclare", async () => {
    const tenant = await resolveTenantFromHost("localhost:3000");
    expect(tenant?.id).toBe("foulard-teranga");
  });

  it("ignore la casse et le port", async () => {
    const tenant = await resolveTenantFromHost("BOUTIQUE-VOISINE.CI:8080");
    expect(tenant?.id).toBe("boutique-voisine");
  });

  it("renvoie null pour un hôte inconnu au lieu de retomber sur une boutique", async () => {
    expect(await resolveTenantFromHost("inconnu.example.com")).toBeNull();
  });

  it("expose le thème de la boutique résolue", async () => {
    const tenant = await resolveTenantFromHost("boutique-voisine.ci");
    expect(tenant?.theme).toEqual({
      primaryColor: "#0E9F6E",
      accentColor: "#C9A227",
      logoText: "Boutique Voisine",
    });
  });

  it("résout admin.<domaine> vers la même boutique que le domaine nu", async () => {
    const tenant = await resolveTenantFromHost("admin.boutique-voisine.ci");
    expect(tenant?.id).toBe("boutique-voisine");
  });

  it("résout platform.<domaine> vers la même boutique que le domaine nu", async () => {
    const tenant = await resolveTenantFromHost("platform.boutique-voisine.ci");
    expect(tenant?.id).toBe("boutique-voisine");
  });
});

describe("statut de la boutique", () => {
  it("remonte le statut de la boutique résolue", async () => {
    findMany.mockResolvedValue(ROWS);
    const tenant = await resolveTenantFromHost("localhost");
    expect(tenant?.status).toBe("active");
  });

  it("remonte un statut suspendu sans masquer la boutique — c'est aux layouts de décider", async () => {
    findMany.mockResolvedValue([{ ...ROWS[0], status: "suspended" }]);
    const tenant = await resolveTenantFromHost("localhost");
    expect(tenant).not.toBeNull();
    expect(tenant?.status).toBe("suspended");
  });
});
