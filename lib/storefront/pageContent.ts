import { z } from "zod";
import {
  DEFAULT_BLOCK_ORDER,
  DEFAULT_BLOCK_NAMES,
  type BlockId,
} from "./blockIds";
import { BLOCK_SETTINGS } from "./blockSettings";

const BLOCK_IDS = new Set<string>(DEFAULT_BLOCK_ORDER);

export interface BlockInstance {
  type: BlockId;
  name: string;
  visible: boolean;
  settings: Record<string, unknown>;
}

export interface StorefrontPageContent {
  blocks: BlockInstance[];
}

const blockInstanceSchema = z.object({
  type: z.string(),
  name: z.string(),
  visible: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
});

export const pageContentSchema = z.object({
  blocks: z.array(blockInstanceSchema),
});

export function defaultPage(): StorefrontPageContent {
  return {
    blocks: DEFAULT_BLOCK_ORDER.map((type) => ({
      type,
      name: DEFAULT_BLOCK_NAMES[type],
      visible: true,
      settings: structuredClone(BLOCK_SETTINGS[type].defaults) as Record<string, unknown>,
    })),
  };
}

/**
 * Valide un JSON stocké et le normalise. Toute anomalie (structure invalide,
 * type de bloc inconnu, réglages qui ne parsent pas) retombe sur les valeurs
 * par défaut du bloc plutôt que de casser la vitrine.
 */
export function parsePageContent(raw: unknown): StorefrontPageContent {
  const parsed = pageContentSchema.safeParse(raw);
  if (!parsed.success) return defaultPage();

  const blocks: BlockInstance[] = [];
  for (const b of parsed.data.blocks) {
    if (!BLOCK_IDS.has(b.type)) continue; // filtre types inconnus
    const type = b.type as BlockId;
    const settingsParse = BLOCK_SETTINGS[type].schema.safeParse(b.settings);
    blocks.push({
      type,
      name: b.name,
      visible: b.visible,
      settings: settingsParse.success
        ? (b.settings as Record<string, unknown>)
        : (structuredClone(BLOCK_SETTINGS[type].defaults) as Record<string, unknown>),
    });
  }
  return blocks.length > 0 ? { blocks } : defaultPage();
}

export function moveBlock(
  page: StorefrontPageContent,
  type: BlockId,
  dir: -1 | 1
): StorefrontPageContent {
  const blocks = [...page.blocks];
  const i = blocks.findIndex((b) => b.type === type);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return page;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return { blocks };
}

export function setBlockVisible(
  page: StorefrontPageContent,
  type: BlockId,
  visible: boolean
): StorefrontPageContent {
  return { blocks: page.blocks.map((b) => (b.type === type ? { ...b, visible } : b)) };
}

export function renameBlock(
  page: StorefrontPageContent,
  type: BlockId,
  name: string
): StorefrontPageContent {
  return { blocks: page.blocks.map((b) => (b.type === type ? { ...b, name } : b)) };
}

export function updateBlockSettings(
  page: StorefrontPageContent,
  type: BlockId,
  key: string,
  value: unknown
): StorefrontPageContent {
  return {
    blocks: page.blocks.map((b) =>
      b.type === type ? { ...b, settings: { ...b.settings, [key]: value } } : b
    ),
  };
}
