# Multi-Instance Blocks Implementation Plan (Chantier 2/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque bloc de la vitrine un identifiant d'instance unique et les opérations pures `addBlock` / `duplicateBlock` / `removeBlock` / `reorderBlocks`, avec compatibilité totale des pages existantes — fondation du chantier 3 (UX éditeur).

**Architecture:** Le JSON `StorefrontPageContent` passe d'un identifiant-par-type à un `id` d'instance. `parsePageContent` (déjà appelé à chaque lecture, brouillon et publié) migre l'ancien format à la volée avec des ids **déterministes** (`id = type`) — indispensable : le même JSON doit produire les mêmes ids à chaque parse (hydratation serveur/client, stabilité des tests). Les uuid aléatoires n'apparaissent que dans `addBlock`/`duplicateBlock` (action utilisateur, puis persisté). Les ancres DOM (`#ft-story`, `#ft-contact`) ne sont posées que sur la première instance de leur type. Ce chantier ne change **pas** l'UX de l'éditeur (boutons ↑/↓ conservés) : il ne fait qu'adapter sélection et clés React aux ids — l'UI d'ajout/duplication/suppression arrive au chantier 3.

**Tech Stack:** TypeScript strict, Zod 4, Vitest. Aucune dépendance ajoutée, aucune migration DB (le JSON est normalisé à la lecture).

**Spec:** `docs/superpowers/specs/2026-07-18-vitrine-cms-images-digitpad-design.md` (§ Chantier 2)

## Global Constraints

- Langue produit : FR. Code, commits, identifiants : EN. Commentaires FR = convention du repo. Conventional Commits.
- TypeScript strict, jamais de `any`.
- **Aucun aléatoire dans `defaultPage()` ni `parsePageContent()`** — ids déterministes uniquement (`id = type` pour les défauts et l'héritage ; suffixe positionnel en cas de doublon). `crypto.randomUUID()` seulement dans `addBlock`/`duplicateBlock`.
- Toutes les opérations sur la page restent **pures et immuables** (pas de mutation de l'argument).
- Compatibilité ascendante : un JSON ancien format (sans `id`) doit parser sans erreur ; le rendu public d'une page existante ne change pas d'un pixel.
- `removeBlock` ne doit jamais produire une page vide (`parsePageContent` retomberait sur `defaultPage()` et « ressusciterait » les 9 blocs à l'enregistrement suivant) : la dernière instance restante n'est pas supprimable.
- Icônes de la bibliothèque de blocs : **volontairement différées au chantier 3** — `ICONS` vit dans `components/ui/Icon` (module client) et `blockSettings.ts` doit rester server-safe (cf. l'avertissement en tête de `lib/storefront/blockIds.ts`). Le registry du chantier 2 porte libellé + description ; l'éditeur mappera `BlockId → icône` côté client.
- Vérification par tâche : `npm run typecheck` et `npm test` avant chaque commit.

---

### Task 1: `BlockInstance.id` — schéma, migration à la volée, opérations re-signées

**Files:**
- Modify: `lib/storefront/pageContent.ts` (remplacement complet, fourni ci-dessous)
- Test: `lib/storefront/pageContent.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_BLOCK_ORDER`, `DEFAULT_BLOCK_NAMES`, `BlockId` (`./blockIds`), `BLOCK_SETTINGS` (`./blockSettings`) — inchangés.
- Produces: `BlockInstance` avec `id: string` requis en sortie (`optional` en entrée Zod) ; `defaultPage()` avec `id = type` ; `parsePageContent` qui assigne/dé-duplique les ids ; `moveBlock(page, id: string, dir)`, `setBlockVisible(page, id: string, visible)`, `renameBlock(page, id: string, name)`, `updateBlockSettings(page, id: string, key, value)` — **le paramètre passe de `BlockId` à `string`** (les appels existants de l'éditeur compilent toujours : un `BlockId` est un `string`, et les ids des blocs par défaut valent leur `type`).

- [ ] **Step 1: Write the failing tests**

Dans `lib/storefront/pageContent.test.ts`, ajouter un `describe` (les tests existants ne bougent pas à cette étape) :

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/storefront/pageContent.test.ts`
Expected: FAIL — `b.id` n'existe pas (TypeScript) / ids absents.

- [ ] **Step 3: Replace `lib/storefront/pageContent.ts` entirely**

```ts
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
```

- [ ] **Step 4: Run the full pageContent suite**

Run: `npm test -- lib/storefront/pageContent.test.ts`
Expected: PASS — les nouveaux tests **et** les tests existants (les appels `moveBlock(page, "cats", -1)` etc. restent valides : les ids des blocs par défaut valent leur type ; les `toEqual(defaultPage())` restent vrais car les ids sont déterministes).

- [ ] **Step 5: Typecheck the whole app**

Run: `npm run typecheck && npm test`
Expected: PASS sans modifier l'éditeur — `VitrineEditor` passe `selectedBlock.type` (un `BlockId`, donc un `string`) aux opérations, ce qui reste correct tant que les ids par défaut valent le type. L'adaptation propre de l'éditeur arrive en Task 4. Si un autre appelant casse, le corriger dans le même esprit (passer une valeur qui est déjà un id).

- [ ] **Step 6: Commit**

```bash
git add lib/storefront/pageContent.ts lib/storefront/pageContent.test.ts
git commit -m "feat(storefront): instance ids for page blocks with legacy migration"
```

---

### Task 2: Opérations `addBlock` / `duplicateBlock` / `removeBlock` / `reorderBlocks`

**Files:**
- Modify: `lib/storefront/pageContent.ts` (ajout de 4 fonctions en fin de fichier)
- Test: `lib/storefront/pageContent.test.ts`

**Interfaces:**
- Consumes: `BlockInstance`, `DEFAULT_BLOCK_NAMES`, `BLOCK_SETTINGS` (Task 1).
- Produces (consommées par le chantier 3) :
  - `addBlock(page, type: BlockId): { page: StorefrontPageContent; id: string }` — insertion en fin, réglages par défaut, nom auto-suffixé (« Bandeau Hero 2 » s'il existe déjà un bloc du type), `id` = uuid.
  - `duplicateBlock(page, id: string): { page: StorefrontPageContent; id: string }` — clone profond inséré juste après l'original, nom « X (copie) » ; id inconnu → page inchangée et `id` retourné tel quel.
  - `removeBlock(page, id: string): StorefrontPageContent` — jamais de page vide (dernier bloc non supprimable).
  - `reorderBlocks(page, fromId: string, toId: string): StorefrontPageContent` — déplace `fromId` à la position de `toId` ; ids inconnus ou identiques → page inchangée.

- [ ] **Step 1: Write the failing tests**

Ajouter dans `lib/storefront/pageContent.test.ts` :

```ts
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
```

(Compléter l'import en tête de fichier : `addBlock, duplicateBlock, removeBlock, reorderBlocks`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/storefront/pageContent.test.ts`
Expected: FAIL — fonctions inexistantes.

- [ ] **Step 3: Implement — append to `lib/storefront/pageContent.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/storefront/pageContent.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storefront/pageContent.ts lib/storefront/pageContent.test.ts
git commit -m "feat(storefront): add/duplicate/remove/reorder block operations"
```

---

### Task 3: Métadonnées de bibliothèque de blocs (registry)

**Files:**
- Modify: `lib/storefront/blockSettings.ts` (ajout en fin de fichier)
- Test: `lib/storefront/blockSettings.test.ts` (ajout d'un describe)

**Interfaces:**
- Consumes: `BlockId` (`./blockIds`).
- Produces (consommé par le `BlockPicker` du chantier 3) :
  - `interface BlockLibraryEntry { label: string; description: string }`
  - `BLOCK_LIBRARY: Record<BlockId, BlockLibraryEntry>`
  - Pas d'icônes ici (module server-safe — cf. Global Constraints) : le chantier 3 mappera `BlockId → icône` dans un composant client.

- [ ] **Step 1: Write the failing test**

Dans `lib/storefront/blockSettings.test.ts` : le fichier importe déjà `DEFAULT_BLOCK_ORDER` depuis `@/lib/store/useStorefront` — ajouter `BLOCK_LIBRARY` à l'import existant de `./blockSettings`, puis ajouter en fin de fichier :

```ts
describe("BLOCK_LIBRARY", () => {
  it("couvre chaque type de bloc avec libellé et description non vides", () => {
    for (const type of DEFAULT_BLOCK_ORDER) {
      expect(BLOCK_LIBRARY[type].label.length).toBeGreaterThan(0);
      expect(BLOCK_LIBRARY[type].description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/storefront/blockSettings.test.ts`
Expected: FAIL — `BLOCK_LIBRARY` inexistant.

- [ ] **Step 3: Implement — append to `lib/storefront/blockSettings.ts`**

```ts
/** Métadonnées de la bibliothèque de blocs (sélecteur « + Ajouter un bloc »).
 *  Module server-safe : pas d'icônes ici — l'éditeur (client) mappe BlockId → icône. */
export interface BlockLibraryEntry {
  label: string;
  description: string;
}

export const BLOCK_LIBRARY: Record<BlockId, BlockLibraryEntry> = {
  hero: { label: "Bandeau Hero", description: "Grande image d'accueil avec titre et boutons." },
  cats: { label: "Vignettes catégories", description: "Accès rapide aux catégories de la boutique." },
  grid: { label: "Grille de produits", description: "Nouveautés et best-sellers du catalogue." },
  loyalty: { label: "Bandeau fidélité", description: "Met en avant le programme de points." },
  featured: { label: "Produit vedette", description: "Zoom sur le produit marqué « vedette »." },
  story: { label: "Notre histoire", description: "Texte de présentation, photo et chiffres clés." },
  look: { label: "Galerie / Lookbook", description: "Mosaïque de photos portées." },
  news: { label: "Newsletter", description: "Formulaire d'inscription aux nouveautés." },
  contact: { label: "Contact & localisation", description: "Adresse, horaires et contact WhatsApp." },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/storefront/blockSettings.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storefront/blockSettings.ts lib/storefront/blockSettings.test.ts
git commit -m "feat(storefront): block library metadata in registry"
```

---

### Task 4: Rendu et éditeur conscients des instances (clés, sélection, ancres)

**Files:**
- Modify: `components/storefront/blocks/renderBlock.tsx`
- Modify: `components/storefront/blocks/StoryBlock.tsx` (ligne `<section id="ft-story" …>`)
- Modify: `components/storefront/blocks/ContactBlock.tsx` (ligne `<section id="ft-contact" …>`)
- Modify: `components/storefront/HomeShell.tsx:21-23`
- Modify: `components/editor/VitrineEditor.tsx`

**Interfaces:**
- Consumes: `BlockInstance.id` (Task 1) ; opérations re-signées par id (Task 1).
- Produces: `BlockRenderContext` gagne `anchored?: boolean` (défaut `true`) ; `StoryBlock`/`ContactBlock` gagnent la prop `anchored?: boolean` (défaut `true`) ; l'état `selected` de l'éditeur devient un id d'instance (`string`).

- [ ] **Step 1: Anchor plumbing in renderBlock and the two anchored blocks**

1. `renderBlock.tsx` — étendre le contexte et le passer aux deux blocs à ancre :

```ts
export interface BlockRenderContext {
  products: Product[];
  whatsappPhone?: string | null;
  /** Pose l'ancre DOM (#ft-story / #ft-contact). Seule la première instance
   *  d'un type la porte — évite les ids dupliqués avec les multi-instances. */
  anchored?: boolean;
}
```

et dans le `switch` :

```tsx
    case "story":
      return <StoryBlock settings={instance.settings as StorySettings} anchored={ctx.anchored ?? true} />;
    // …
    case "contact":
      return <ContactBlock settings={instance.settings as ContactSettings} whatsappPhone={whatsappPhone} anchored={ctx.anchored ?? true} />;
```

2. `StoryBlock.tsx` — ajouter la prop et conditionner l'ancre (signature existante enrichie) :

```tsx
export function StoryBlock({ settings, anchored = true }: { settings: StorySettings; anchored?: boolean }) {
```

et remplacer `<section id="ft-story"` par `<section id={anchored ? "ft-story" : undefined}`.

3. `ContactBlock.tsx` — même motif avec `"ft-contact"`.

- [ ] **Step 2: HomeShell keys + first-instance anchors**

Dans `components/storefront/HomeShell.tsx`, remplacer la boucle :

```tsx
      {visible.map((b, i) => (
        <div key={b.id}>
          {renderBlock(b, {
            products,
            whatsappPhone,
            anchored: visible.findIndex((x) => x.type === b.type) === i,
          })}
        </div>
      ))}
```

- [ ] **Step 3: Editor selection by instance id**

Dans `components/editor/VitrineEditor.tsx` :

1. Supprimer l'import `type { BlockId } from "@/lib/store/useStorefront"` (devenu inutile).
2. État de sélection :

```ts
  const [selected, setSelected] = useState<string>(initialPage.blocks[0]?.id ?? "");
```

3. `const selectedBlock = page.blocks.find((b) => b.id === selected) ?? page.blocks[0];`
4. Boucle canevas — clé et sélection par id, ancre première instance :

```tsx
          {page.blocks.map((b, i) => (
            <div
              key={b.id}
              onClick={() => setSelected(b.id)}
              style={{
                position: "relative", cursor: "pointer", opacity: b.visible ? 1 : 0.4,
                outline: selected === b.id ? `2px solid ${colors.primary}` : "2px solid transparent",
                outlineOffset: -2,
              }}
            >
              {renderBlock(b, {
                products,
                whatsappPhone,
                anchored: page.blocks.findIndex((x) => x.type === b.type) === i,
              })}
            </div>
          ))}
```

5. Les callbacks passent l'id d'instance :

```tsx
              onChangeSetting={(key, value) => apply(updateBlockSettings(page, selectedBlock.id, key, value))}
              onRename={(name) => apply(renameBlock(page, selectedBlock.id, name))}
              onToggleVisible={() => apply(setBlockVisible(page, selectedBlock.id, !selectedBlock.visible))}
              onMove={(dir) => apply(moveBlock(page, selectedBlock.id, dir))}
```

(`BlockSettingsPanel` ne change pas : il ne consomme que `block` et les callbacks.)

- [ ] **Step 4: Typecheck, tests, controller browser smoke**

Run: `npm run typecheck && npm test`
Expected: PASS.
Vérification navigateur (contrôleur) : `/admin/vitrine` — sélection au clic, renommage, ↑/↓, masquer, publier ; `/` — page publiée identique (ancre `#ft-story` toujours atteinte par le bouton « Notre histoire » du Hero) ; aucun warning « duplicate key » en console.

- [ ] **Step 5: Commit**

```bash
git add components/storefront/blocks/renderBlock.tsx components/storefront/blocks/StoryBlock.tsx components/storefront/blocks/ContactBlock.tsx components/storefront/HomeShell.tsx components/editor/VitrineEditor.tsx
git commit -m "feat(storefront): instance-aware rendering, anchors and editor selection"
```

---

### Task 5: Vérification de bout en bout

**Files:** aucun nouveau.

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm test && npx next build --webpack`
Expected: tout PASS. (⚠️ `--webpack` obligatoire : Turbopack panique sur les accents NFD du chemin.)

- [ ] **Step 2: Browser pass (controller)**

1. `/` (vitrine publiée) : rendu strictement identique à avant le chantier (aucun changement visuel attendu).
2. `/admin/vitrine` : éditer un titre → autosave → publier → vérifier sur `/`.
3. Vérifier en base (`StorefrontPage.draft`) que le JSON réenregistré porte désormais des `id` sur chaque bloc.

- [ ] **Step 3: Fixups commit (only if needed)**

```bash
git add -A && git commit -m "fix(storefront): multi-instance foundations fixups"
```
