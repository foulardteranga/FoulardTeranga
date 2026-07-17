import { describe, expect, it } from "vitest";
import { BLOCK_SETTINGS, heroFields, storyFields, catsFields, lookFields } from "./blockSettings";
import { DEFAULT_BLOCK_ORDER } from "@/lib/store/useStorefront";

describe("BLOCK_SETTINGS", () => {
  it("couvre exactement les 9 types de blocs", () => {
    expect(Object.keys(BLOCK_SETTINGS).sort()).toEqual([...DEFAULT_BLOCK_ORDER].sort());
  });

  it("les valeurs par défaut de chaque bloc parsent leur schéma", () => {
    for (const [type, def] of Object.entries(BLOCK_SETTINGS)) {
      const parsed = def.schema.safeParse(def.defaults);
      expect(parsed.success, `defaults invalides pour ${type}`).toBe(true);
    }
  });

  it("chaque descripteur de champ pointe vers une clé du schéma", () => {
    for (const [type, def] of Object.entries(BLOCK_SETTINGS)) {
      const keys = Object.keys(def.defaults as Record<string, unknown>);
      for (const f of def.fields) {
        expect(keys, `champ ${f.key} absent des defaults de ${type}`).toContain(f.key);
      }
    }
  });
});

describe("champs image", () => {
  it("hero.backgroundImage, story.image et cats.*Image sont des champs de type image", () => {
    expect(heroFields.find((f) => f.key === "backgroundImage")?.kind).toBe("image");
    expect(storyFields.find((f) => f.key === "image")?.kind).toBe("image");
    expect(catsFields.find((f) => f.key === "foulardsImage")?.kind).toBe("image");
    expect(catsFields.find((f) => f.key === "turbansImage")?.kind).toBe("image");
    expect(catsFields.find((f) => f.key === "accessoiresImage")?.kind).toBe("image");
  });

  it("look.images est un champ de type imageList, vide par défaut", () => {
    expect(lookFields.find((f) => f.key === "images")?.kind).toBe("imageList");
    expect(BLOCK_SETTINGS.look.defaults).toMatchObject({ images: [] });
  });
});
