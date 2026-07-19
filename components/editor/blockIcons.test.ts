import { describe, it, expect } from "vitest";
import { DEFAULT_BLOCK_ORDER } from "@/lib/storefront/blockIds";
import { BLOCK_ICONS } from "./blockIcons";

describe("BLOCK_ICONS", () => {
  it("fournit une icône non vide pour chaque type de bloc", () => {
    for (const type of DEFAULT_BLOCK_ORDER) {
      expect(BLOCK_ICONS[type].length).toBeGreaterThan(0);
    }
  });

  it("couvre exactement les 9 types de blocs, sans clé en trop", () => {
    expect(Object.keys(BLOCK_ICONS).sort()).toEqual([...DEFAULT_BLOCK_ORDER].sort());
  });
});
