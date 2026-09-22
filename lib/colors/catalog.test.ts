import { describe, it, expect } from "vitest";
import { searchColors, COLOR_CATALOG } from "./catalog";

describe("COLOR_CATALOG", () => {
  it("contient au moins 80 teintes répertoriées", () => {
    expect(COLOR_CATALOG.length).toBeGreaterThanOrEqual(80);
  });

  it("chaque teinte possède un nom, un code HEX valide et une famille", () => {
    for (const c of COLOR_CATALOG) {
      expect(c.name).toBeTruthy();
      expect(c.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(c.family).toBeTruthy();
      expect(Array.isArray(c.aliases)).toBe(true);
    }
  });
});

describe("searchColors", () => {
  it("trouve 'Bordeaux' par nom exact", () => {
    const res = searchColors("Bordeaux");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].name).toBe("Bordeaux");
  });

  it("trouve 'Bordeaux' par alias 'Burgundy' ou 'Lie-de-vin'", () => {
    const res1 = searchColors("burgundy");
    expect(res1.some((c) => c.name === "Bordeaux")).toBe(true);

    const res2 = searchColors("lie de vin");
    expect(res2.some((c) => c.name === "Bordeaux")).toBe(true);
  });

  it("est insensible aux accents (ex. 'bleu fonce', 'rose poudre')", () => {
    const res1 = searchColors("bleu fonce");
    expect(res1.some((c) => c.name.toLowerCase().includes("bleu"))).toBe(true);

    const res2 = searchColors("poudre");
    expect(res2.some((c) => c.name.toLowerCase().includes("poudré"))).toBe(true);
  });

  it("inclut les couleurs personnalisées fournies en argument", () => {
    const custom = [
      { name: "Terracotta de Korhogo", hex: "#C86442", family: "Terres", aliases: ["Korhogo"] },
    ];
    const res = searchColors("Korhogo", custom);
    expect(res.some((c) => c.name === "Terracotta de Korhogo")).toBe(true);
  });
});
