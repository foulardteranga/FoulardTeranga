import { describe, expect, it } from "vitest";
import {
  defaultPage,
  parsePageContent,
  moveBlock,
  setBlockVisible,
  renameBlock,
  updateBlockSettings,
} from "./pageContent";
import { DEFAULT_BLOCK_ORDER } from "@/lib/store/useStorefront";

describe("defaultPage", () => {
  it("contient les 9 blocs dans l'ordre par défaut, tous visibles", () => {
    const page = defaultPage();
    expect(page.blocks.map((b) => b.type)).toEqual(DEFAULT_BLOCK_ORDER);
    expect(page.blocks.every((b) => b.visible)).toBe(true);
  });
});

describe("parsePageContent", () => {
  it("retombe sur defaultPage si l'entrée est corrompue", () => {
    expect(parsePageContent("nope")).toEqual(defaultPage());
    expect(parsePageContent({ blocks: "x" })).toEqual(defaultPage());
  });

  it("filtre les blocs de type inconnu", () => {
    const page = defaultPage();
    const withUnknown = { blocks: [...page.blocks, { type: "zzz", name: "X", visible: true, settings: {} }] };
    const parsed = parsePageContent(withUnknown);
    expect(parsed.blocks.map((b) => b.type)).toEqual(DEFAULT_BLOCK_ORDER);
  });

  it("préserve une page valide (round-trip)", () => {
    const page = defaultPage();
    expect(parsePageContent(JSON.parse(JSON.stringify(page)))).toEqual(page);
  });

  it("remplace par les réglages par défaut un bloc connu dont les settings sont invalides (sans le supprimer)", () => {
    const parsed = parsePageContent({
      blocks: [{ type: "hero", name: "X", visible: true, settings: { title: 123 } }],
    });
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0].type).toBe("hero");
    // settings retombent sur les valeurs par défaut du hero
    const heroDefault = defaultPage().blocks.find((b) => b.type === "hero")!.settings;
    expect(parsed.blocks[0].settings).toEqual(heroDefault);
  });

  it("defaultPage retourne des réglages indépendants à chaque appel (pas de référence partagée)", () => {
    const a = defaultPage();
    (a.blocks[0].settings as Record<string, unknown>).title = "MUTÉ";
    const b = defaultPage();
    expect((b.blocks[0].settings as Record<string, unknown>).title).not.toBe("MUTÉ");
  });
});

describe("réducteurs", () => {
  it("moveBlock déplace un bloc et est immuable", () => {
    const page = defaultPage();
    const moved = moveBlock(page, "cats", -1);
    expect(moved.blocks[0].type).toBe("cats");
    expect(page.blocks[0].type).toBe("hero"); // original inchangé
  });

  it("moveBlock ignore un déplacement hors limites", () => {
    const page = defaultPage();
    expect(moveBlock(page, "hero", -1)).toEqual(page);
  });

  it("setBlockVisible bascule la visibilité", () => {
    const page = setBlockVisible(defaultPage(), "news", false);
    expect(page.blocks.find((b) => b.type === "news")!.visible).toBe(false);
  });

  it("renameBlock change le nom", () => {
    const page = renameBlock(defaultPage(), "hero", "Accueil");
    expect(page.blocks.find((b) => b.type === "hero")!.name).toBe("Accueil");
  });

  it("updateBlockSettings modifie une clé de réglage", () => {
    const page = updateBlockSettings(defaultPage(), "hero", "title", "Nouveau");
    expect(page.blocks.find((b) => b.type === "hero")!.settings.title).toBe("Nouveau");
  });
});
