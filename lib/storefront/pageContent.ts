import { z } from "zod";
import {
  DEFAULT_BLOCK_ORDER,
  DEFAULT_BLOCK_NAMES,
  type BlockId,
} from "./blockIds";
import { BLOCK_SETTINGS } from "./blockSettings";

const BLOCK_IDS = new Set<string>(DEFAULT_BLOCK_ORDER);

export interface BlockInstance {
  /** Identifiant unique de l'instance. Déterministe (= type) pour les pages
   *  héritées et les défauts ; uuid pour les blocs ajoutés/dupliqués. */
  id: string;
  type: BlockId;
  name: string;
  visible: boolean;
  settings: Record<string, unknown>;
}

export interface StorefrontPageContent {
  blocks: BlockInstance[];
}

const blockInstanceSchema = z.object({
  id: z.string().optional(), // absent dans l'ancien format — assigné au parse
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
      // id = type : déterministe, identique à chaque appel (hydratation
      // serveur/client et comparaisons de tests exigent zéro aléatoire ici).
      id: type,
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
 * par défaut du bloc plutôt que de casser la vitrine. Les blocs sans `id`
 * (ancien format) ou avec un id en collision reçoivent un id déterministe.
 */
export function parsePageContent(raw: unknown): StorefrontPageContent {
  const parsed = pageContentSchema.safeParse(raw);
  if (!parsed.success) return defaultPage();

  const blocks: BlockInstance[] = [];
  const seen = new Set<string>();
  for (const [i, b] of parsed.data.blocks.entries()) {
    if (!BLOCK_IDS.has(b.type)) continue; // filtre types inconnus
    const type = b.type as BlockId;
    let id = b.id ?? type;
    if (seen.has(id)) id = `${type}-${i}`;
    while (seen.has(id)) id += "x"; // garde-fou : unicité garantie, toujours déterministe
    seen.add(id);
    const settingsParse = BLOCK_SETTINGS[type].schema.safeParse(b.settings);
    blocks.push({
      id,
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
  id: string,
  dir: -1 | 1
): StorefrontPageContent {
  const blocks = [...page.blocks];
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return page;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return { blocks };
}

export function setBlockVisible(
  page: StorefrontPageContent,
  id: string,
  visible: boolean
): StorefrontPageContent {
  return { blocks: page.blocks.map((b) => (b.id === id ? { ...b, visible } : b)) };
}

export function renameBlock(
  page: StorefrontPageContent,
  id: string,
  name: string
): StorefrontPageContent {
  return { blocks: page.blocks.map((b) => (b.id === id ? { ...b, name } : b)) };
}

export function updateBlockSettings(
  page: StorefrontPageContent,
  id: string,
  key: string,
  value: unknown
): StorefrontPageContent {
  return {
    blocks: page.blocks.map((b) =>
      b.id === id ? { ...b, settings: { ...b.settings, [key]: value } } : b
    ),
  };
}

/** Insère un nouveau bloc du type demandé en fin de page (réglages par défaut,
 *  nom auto-suffixé si le type est déjà présent). Retourne l'id créé pour que
 *  l'éditeur puisse sélectionner le bloc. */
export function addBlock(
  page: StorefrontPageContent,
  type: BlockId
): { page: StorefrontPageContent; id: string } {
  const count = page.blocks.filter((b) => b.type === type).length;
  const name =
    count === 0 ? DEFAULT_BLOCK_NAMES[type] : `${DEFAULT_BLOCK_NAMES[type]} ${count + 1}`;
  const id = crypto.randomUUID();
  const block: BlockInstance = {
    id,
    type,
    name,
    visible: true,
    settings: structuredClone(BLOCK_SETTINGS[type].defaults) as Record<string, unknown>,
  };
  return { page: { blocks: [...page.blocks, block] }, id };
}

/** Clone profond de l'instance, inséré juste sous l'original. */
export function duplicateBlock(
  page: StorefrontPageContent,
  id: string
): { page: StorefrontPageContent; id: string } {
  const i = page.blocks.findIndex((b) => b.id === id);
  if (i < 0) return { page, id };
  const src = page.blocks[i];
  const copy: BlockInstance = {
    ...src,
    id: crypto.randomUUID(),
    name: `${src.name} (copie)`,
    settings: structuredClone(src.settings),
  };
  const blocks = [...page.blocks];
  blocks.splice(i + 1, 0, copy);
  return { page: { blocks }, id: copy.id };
}

/** Supprime l'instance visée — sauf la dernière : une page vide serait
 *  « ressuscitée » en page par défaut par parsePageContent au prochain parse. */
export function removeBlock(page: StorefrontPageContent, id: string): StorefrontPageContent {
  if (page.blocks.length <= 1) return page;
  const blocks = page.blocks.filter((b) => b.id !== id);
  return blocks.length === page.blocks.length ? page : { blocks };
}

/** Déplace l'instance `fromId` à la position occupée par `toId` (drag-and-drop). */
export function reorderBlocks(
  page: StorefrontPageContent,
  fromId: string,
  toId: string
): StorefrontPageContent {
  const from = page.blocks.findIndex((b) => b.id === fromId);
  const to = page.blocks.findIndex((b) => b.id === toId);
  if (from < 0 || to < 0 || from === to) return page;
  const blocks = [...page.blocks];
  const [item] = blocks.splice(from, 1);
  blocks.splice(to, 0, item);
  return { blocks };
}
