import { describe, it, expect } from "vitest";
import { generateShades, hexToHsl, hslToHex } from "./shades";

describe("hexToHsl & hslToHex", () => {
  it("convertit correctement du noir pur", () => {
    const hsl = hexToHsl("#000000");
    expect(hsl.l).toBe(0);
    expect(hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase()).toBe("#000000");
  });

  it("convertit correctement du blanc pur", () => {
    const hsl = hexToHsl("#ffffff");
    expect(hsl.l).toBe(100);
    expect(hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase()).toBe("#ffffff");
  });

  it("aller-retour stable sur une couleur textile (#6B1D2F - Bordeaux)", () => {
    const hex = "#6b1d2f";
    const { h, s, l } = hexToHsl(hex);
    const converted = hslToHex(h, s, l).toLowerCase();
    expect(converted).toBe(hex);
  });
});

describe("generateShades", () => {
  it("génère exactement 5 nuances pour une couleur donnée", () => {
    const shades = generateShades("#6B1D2F", "Bordeaux");
    expect(shades).toHaveLength(5);
    for (const shade of shades) {
      expect(shade.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(shade.label).toBeTruthy();
      expect(["ref", "light", "dark", "vivid", "soft"]).toContain(shade.role);
    }
  });

  it("la nuance 'ref' correspond exactement au hex et au nom de base", () => {
    const shades = generateShades("#D07A34", "Terracotta");
    const ref = shades.find((s) => s.role === "ref");
    expect(ref).toBeDefined();
    expect(ref?.hex.toLowerCase()).toBe("#d07a34");
    expect(ref?.label).toBe("Terracotta (Original)");
  });

  it("la nuance 'light' a une luminosité supérieure", () => {
    const baseHex = "#6B1D2F";
    const shades = generateShades(baseHex, "Bordeaux");
    const light = shades.find((s) => s.role === "light")!;
    const baseHsl = hexToHsl(baseHex);
    const lightHsl = hexToHsl(light.hex);
    expect(lightHsl.l).toBeGreaterThan(baseHsl.l);
  });
});
