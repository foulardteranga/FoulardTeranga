import { describe, it, expect } from "vitest";
import { normalizeDomain, isValidDomain, parseDomains } from "./domains";

describe("normalizeDomain", () => {
  it("retire le schéma, le chemin, le port et met en minuscules", () => {
    expect(normalizeDomain("  HTTPS://Boutique.CI:443/accueil  ")).toBe("boutique.ci");
  });

  it("retire le point final d'un FQDN absolu", () => {
    expect(normalizeDomain("boutique.ci.")).toBe("boutique.ci");
  });

  it("laisse un hôte déjà normalisé inchangé", () => {
    expect(normalizeDomain("foulard-teranga.localhost")).toBe("foulard-teranga.localhost");
  });
});

describe("isValidDomain", () => {
  it("accepte un hôte simple sans point (localhost)", () => {
    expect(isValidDomain("localhost")).toBe(true);
  });

  it("accepte un domaine avec tirets et sous-domaines", () => {
    expect(isValidDomain("boutique-du-plateau.ci")).toBe(true);
  });

  it("refuse un hôte contenant une espace", () => {
    expect(isValidDomain("boutique du plateau.ci")).toBe(false);
  });

  it("refuse une étiquette commençant ou finissant par un tiret", () => {
    expect(isValidDomain("-boutique.ci")).toBe(false);
    expect(isValidDomain("boutique-.ci")).toBe(false);
  });

  it("refuse une chaîne vide", () => {
    expect(isValidDomain("")).toBe(false);
  });
});

describe("parseDomains", () => {
  it("découpe sur les retours à la ligne et les virgules, en normalisant", () => {
    expect(parseDomains("Boutique.CI\nhttps://www.boutique.ci, localhost")).toEqual({
      ok: true,
      domains: ["boutique.ci", "www.boutique.ci", "localhost"],
    });
  });

  it("dédoublonne après normalisation", () => {
    expect(parseDomains("boutique.ci\nBOUTIQUE.CI:443")).toEqual({
      ok: true,
      domains: ["boutique.ci"],
    });
  });

  it("ignore les lignes vides", () => {
    expect(parseDomains("\n\nboutique.ci\n\n")).toEqual({ ok: true, domains: ["boutique.ci"] });
  });

  it("renvoie une liste vide pour une saisie vide", () => {
    expect(parseDomains("   ")).toEqual({ ok: true, domains: [] });
  });

  it("échoue en nommant le domaine fautif", () => {
    expect(parseDomains("boutique.ci\nnon valide.ci")).toEqual({
      ok: false,
      error: "Domaine invalide : « non valide.ci ».",
    });
  });
});
