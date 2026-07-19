import { describe, expect, it } from "vitest";
import {
  defaultPage,
  parsePageContent,
  moveBlock,
  setBlockVisible,
  renameBlock,
  updateBlockSettings,
  addBlock,
  duplicateBlock,
  removeBlock,
  reorderBlocks,
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

describe("ids d'instance", () => {
  it("defaultPage assigne des ids déterministes égaux au type", () => {
    const page = defaultPage();
    expect(page.blocks.map((b) => b.id)).toEqual(DEFAULT_BLOCK_ORDER);
  });

  it("parsePageContent migre l'ancien format (sans id) avec id = type", () => {
    const legacy = {
      blocks: [
        { type: "hero", name: "Bandeau Hero", visible: true, settings: defaultPage().blocks[0].settings },
        { type: "contact", name: "Contact", visible: false, settings: defaultPage().blocks[8].settings },
      ],
    };
    const parsed = parsePageContent(legacy);
    expect(parsed.blocks.map((b) => b.id)).toEqual(["hero", "contact"]);
    expect(parsed.blocks[1].visible).toBe(false);
  });

  it("le parse est déterministe : deux parses du même JSON donnent les mêmes ids", () => {
    const legacy = JSON.parse(JSON.stringify({ blocks: defaultPage().blocks.map(({ id: _id, ...rest }) => rest) }));
    expect(parsePageContent(legacy)).toEqual(parsePageContent(legacy));
  });

  it("préserve les ids existants (nouveau format) au round-trip", () => {
    const page = defaultPage();
    page.blocks[0].id = "custom-uuid-1";
    expect(parsePageContent(JSON.parse(JSON.stringify(page))).blocks[0].id).toBe("custom-uuid-1");
  });

  it("dé-duplique les ids en collision de façon déterministe", () => {
    const base = defaultPage().blocks[0];
    const parsed = parsePageContent({
      blocks: [
        { ...base, id: "dup" },
        { ...base, id: "dup", name: "Deuxième" },
      ],
    });
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0].id).toBe("dup");
    expect(parsed.blocks[1].id).toBe("hero-1");
    expect(new Set(parsed.blocks.map((b) => b.id)).size).toBe(2);
  });

  it("les opérations ciblent l'id d'instance, pas le type", () => {
    const page = defaultPage();
    page.blocks[0] = { ...page.blocks[0], id: "uuid-hero" };
    const renamed = renameBlock(page, "uuid-hero", "Accueil");
    expect(renamed.blocks[0].name).toBe("Accueil");
    // un id inconnu ne change rien
    expect(renameBlock(page, "hero", "X").blocks[0].name).toBe("Bandeau Hero");
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

describe("addBlock / duplicateBlock / removeBlock / reorderBlocks", () => {
  it("addBlock insère en fin avec les réglages par défaut et un id unique", () => {
    const { page, id } = addBlock(defaultPage(), "hero");
    expect(page.blocks).toHaveLength(10);
    const added = page.blocks[9];
    expect(added.id).toBe(id);
    expect(added.type).toBe("hero");
    expect(added.visible).toBe(true);
    expect(added.settings).toEqual(defaultPage().blocks[0].settings);
    expect(new Set(page.blocks.map((b) => b.id)).size).toBe(10);
  });

  it("addBlock suffixe le nom quand le type existe déjà", () => {
    const { page } = addBlock(defaultPage(), "hero");
    expect(page.blocks[9].name).toBe("Bandeau Hero 2");
  });

  it("addBlock garde le nom de base sur une page qui n'a pas ce type", () => {
    const solo = { blocks: defaultPage().blocks.filter((b) => b.type === "contact") };
    const { page } = addBlock(solo, "hero");
    expect(page.blocks[1].name).toBe("Bandeau Hero");
  });

  it("duplicateBlock clone en profondeur juste sous l'original", () => {
    const base = defaultPage();
    const { page, id } = duplicateBlock(base, "hero");
    expect(page.blocks).toHaveLength(10);
    expect(page.blocks[1].id).toBe(id);
    expect(page.blocks[1].type).toBe("hero");
    expect(page.blocks[1].name).toBe("Bandeau Hero (copie)");
    expect(page.blocks[1].settings).toEqual(page.blocks[0].settings);
    // clone profond : muter la copie ne touche pas l'original
    (page.blocks[1].settings as Record<string, unknown>).title = "MUTÉ";
    expect(page.blocks[0].settings.title).not.toBe("MUTÉ");
  });

  it("duplicateBlock ignore un id inconnu", () => {
    const base = defaultPage();
    expect(duplicateBlock(base, "nope").page).toEqual(base);
  });

  it("removeBlock supprime l'instance visée", () => {
    const page = removeBlock(defaultPage(), "news");
    expect(page.blocks.map((b) => b.id)).not.toContain("news");
    expect(page.blocks).toHaveLength(8);
  });

  it("removeBlock refuse de vider la page (dernier bloc conservé)", () => {
    const solo = { blocks: [defaultPage().blocks[0]] };
    expect(removeBlock(solo, "hero")).toEqual(solo);
  });

  it("reorderBlocks déplace fromId à la position de toId", () => {
    const page = reorderBlocks(defaultPage(), "contact", "hero");
    expect(page.blocks.map((b) => b.id).slice(0, 2)).toEqual(["contact", "hero"]);
  });

  it("reorderBlocks ignore les ids inconnus ou identiques", () => {
    const base = defaultPage();
    expect(reorderBlocks(base, "hero", "hero")).toEqual(base);
    expect(reorderBlocks(base, "zzz", "hero")).toEqual(base);
  });
});
