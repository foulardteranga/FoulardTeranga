import { describe, expect, it } from "vitest";
import { BLOCK_SETTINGS } from "./blockSettings";
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
