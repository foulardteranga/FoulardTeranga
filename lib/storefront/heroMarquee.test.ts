import { describe, expect, it } from "vitest";
import { heroSchema, heroFields, heroDefaults } from "./blockSettings";

describe("Bandeau Hero - Configuration et validation de la bande déroulante d'images", () => {
  it("heroSchema valide les images et rétro-compatibilité", () => {
    // Défaut
    const def = heroSchema.parse(heroDefaults);
    expect(def.images).toEqual([]);

    // Avec 5 images (minimum requis pour le défilement)
    const valid5 = heroSchema.parse({
      ...heroDefaults,
      images: [
        "https://domain/1.webp",
        "https://domain/2.webp",
        "https://domain/3.webp",
        "https://domain/4.webp",
        "https://domain/5.webp",
      ],
    });
    expect(valid5.images).toHaveLength(5);

    // Avec 10 images (maximum autorisé)
    const valid10 = heroSchema.parse({
      ...heroDefaults,
      images: Array.from({ length: 10 }, (_, i) => `https://domain/${i + 1}.webp`),
    });
    expect(valid10.images).toHaveLength(10);
  });

  it("heroFields expose le champ images de type imageList avec minItems: 5 et maxItems: 10", () => {
    const field = heroFields.find((f) => f.key === "images");
    expect(field).toBeDefined();
    expect(field?.kind).toBe("imageList");
    expect(field?.minItems).toBe(5);
    expect(field?.maxItems).toBe(10);
    expect(field?.label).toContain("5 à 10");
  });

  it("vérifie la règle métier d'éligibilité pour la publication (min 5, max 10)", () => {
    function validateHeroImages(images: string[] | undefined): { ok: boolean; error?: string } {
      const list = images || [];
      if (list.length > 0 && list.length < 5) {
        return {
          ok: false,
          error: `Le bandeau Hero nécessite un minimum de 5 images (actuellement ${list.length}/10).`,
        };
      }
      if (list.length > 10) {
        return {
          ok: false,
          error: `Le bandeau Hero accepte un maximum de 10 images (actuellement ${list.length}/10).`,
        };
      }
      return { ok: true };
    }

    // 0 image (non encore configuré / motifs par défaut) -> ok
    expect(validateHeroImages([]).ok).toBe(true);
    expect(validateHeroImages(undefined).ok).toBe(true);

    // 1 à 4 images -> bloqué
    expect(validateHeroImages(["img1"]).ok).toBe(false);
    expect(validateHeroImages(["img1", "img2", "img3"]).ok).toBe(false);
    expect(validateHeroImages(["img1", "img2", "img3", "img4"]).ok).toBe(false);

    // 5 à 10 images -> valide
    expect(validateHeroImages(["1", "2", "3", "4", "5"]).ok).toBe(true);
    expect(validateHeroImages(Array.from({ length: 10 }, (_, i) => `img${i}`)).ok).toBe(true);

    // > 10 images -> bloqué
    expect(validateHeroImages(Array.from({ length: 11 }, (_, i) => `img${i}`)).ok).toBe(false);
  });
});
