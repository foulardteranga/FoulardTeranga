# Storefront Block Content Editing & Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le contenu des 9 blocs de la vitrine éditable sans code par la gérante, persisté par tenant en base avec un modèle brouillon/publié, l'édition servie depuis la zone `/admin` protégée.

**Architecture:** Une table `StorefrontPage` (colonnes JSON `draft`/`published`) stocke la page « home » par tenant. Le contenu est un tableau de blocs typés `{type, name, visible, settings}` validé par Zod. Un module pur (`pageContent.ts`) porte le schéma, les valeurs par défaut (extraites du contenu codé en dur) et les réducteurs d'édition. Un renderer commun mappe les blocs vers les composants (vitrine publique = `published`, éditeur `/admin/vitrine` = `draft`). Les Server Actions (`saveDraft`/`publish`/`revertDraft`) sont gardées `requireZone("dashboard")`.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), React 19, Prisma 7 + Supabase (Postgres + RLS), Zod v4, Vitest. Édition inline React (pas de dnd-kit/Tiptap en v1).

## Global Constraints

- TypeScript strict ; **jamais** de `any` (préférer `unknown` + narrowing).
- Server Components par défaut ; `"use client"` seulement si interactivité ; mutations via Server Actions validées par Zod.
- Accès données **côté serveur uniquement** ; jamais de `service_role` ni requête privilégiée côté client.
- Résultats typés `{ ok: true, ... } | { ok: false, error: string }` pour les Server Actions ; pas d'exception silencieuse.
- Nouvelle table → migration Prisma **+** policy RLS **+** vérification (ici : Supabase advisors, faute de harness de test DB).
- Langue produit : FR (contenu, libellés UI). Code/identifiants : EN.
- Devise : FCFA. Le stock/produits ne sont pas touchés par ce chantier.
- Tests = Vitest sur logique pure uniquement (fichiers `*.test.ts`, `environment: node`). Aucun test branché sur Prisma/DB ni Playwright (non installés). Vérification runtime via le navigateur de preview.
- Périmètre v1 : champs **texte uniquement** (`text | textarea | select | toggle | number | url`). Image, richtext, repeater, productRef **reportés** — les parties image/produits des blocs restent inchangées.

---

## Task 1 : Table `StorefrontPage` + migration + RLS

**Files:**
- Modify: `prisma/schema.prisma` (ajouter le model + relation inverse sur `Tenant`)
- Create: `prisma/migrations/20260715120000_storefront_page/migration.sql`
- Verify: Supabase advisors (sécurité)

**Interfaces:**
- Produces: modèle Prisma `StorefrontPage { id, tenantId, slug, draft Json, published Json, publishedAt, updatedAt, createdAt }`, accessible via `prisma.storefrontPage`.

- [ ] **Step 1 : Ajouter le model au schéma Prisma**

Dans `prisma/schema.prisma`, ajouter après le model `Notification` :

```prisma
model StorefrontPage {
  id          String    @id @default(cuid())
  tenantId    String
  slug        String    @default("home")
  draft       Json
  published   Json
  publishedAt DateTime?
  updatedAt   DateTime  @updatedAt
  createdAt   DateTime  @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, slug])
  @@index([tenantId])
}
```

Et ajouter la relation inverse dans le model `Tenant`, à la suite de `notifications Notification[]` :

```prisma
  storefrontPages StorefrontPage[]
```

- [ ] **Step 2 : Écrire la migration SQL (table + RLS)**

Créer `prisma/migrations/20260715120000_storefront_page/migration.sql` :

```sql
-- Page vitrine "flexible content" par tenant : contenu sérialisé en JSON,
-- versionné brouillon (draft) / publié (published). v1 : une ligne "home".
create table "StorefrontPage" (
  "id"          text not null default gen_random_uuid()::text,
  "tenantId"    text not null references "Tenant"("id"),
  "slug"        text not null default 'home',
  "draft"       jsonb not null,
  "published"   jsonb not null,
  "publishedAt" timestamp(3),
  "updatedAt"   timestamp(3) not null,
  "createdAt"   timestamp(3) not null default now(),
  constraint "StorefrontPage_pkey" primary key ("id")
);

create unique index "StorefrontPage_tenantId_slug_key" on "StorefrontPage" ("tenantId", "slug");
create index "StorefrontPage_tenantId_idx" on "StorefrontPage" ("tenantId");

-- RLS : lecture publique (la vitrine affiche le "published"), écriture réservée
-- aux owner/staff de la boutique. Mêmes helpers que les migrations existantes.
alter table "StorefrontPage" enable row level security;

create policy "storefront_pages_select_public" on "StorefrontPage"
  for select using (true);

create policy "storefront_pages_insert_staff" on "StorefrontPage"
  for insert with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "storefront_pages_update_staff" on "StorefrontPage"
  for update using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );
```

> Note : la lecture publique n'expose que du contenu éditorial de vitrine (pas de données personnelles) ; le rendu public ne lit de toute façon que la colonne `published`.

- [ ] **Step 3 : Appliquer la migration et régénérer le client**

Run :
```bash
npx prisma migrate deploy && npx prisma generate
```
Expected : `Applied migration(s)` incluant `20260715120000_storefront_page`, puis `Generated Prisma Client`.

Si la connexion DB échoue (hotspot instable, cf. incidents connus), réessayer ; en dernier recours appliquer via le MCP Supabase `apply_migration`.

- [ ] **Step 4 : Vérifier RLS via Supabase advisors**

Utiliser le MCP Supabase `get_advisors` (type `security`). Expected : aucun advisor « RLS disabled » ni « policy exposes data » sur `StorefrontPage`. La table doit apparaître avec RLS activé.

- [ ] **Step 5 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260715120000_storefront_page/
git commit -m "feat(storefront): add StorefrontPage table with draft/published + RLS"
```

---

## Task 2 : Schémas, valeurs par défaut et descripteurs de champs des blocs

**Files:**
- Create: `lib/storefront/blockSettings.ts`
- Test: `lib/storefront/blockSettings.test.ts`

**Interfaces:**
- Consumes: `BlockId` depuis `@/lib/store/useStorefront`.
- Produces :
  - `type FieldKind = "text" | "textarea" | "select" | "toggle" | "number" | "url"`
  - `interface FieldDescriptor { key: string; label: string; kind: FieldKind; options?: string[] }`
  - Par bloc : `<block>Schema` (ZodObject), `type <Block>Settings = z.infer<...>`, `<block>Defaults`, `<block>Fields: FieldDescriptor[]`.
  - `BLOCK_SETTINGS: Record<BlockId, { schema: z.ZodTypeAny; defaults: unknown; fields: FieldDescriptor[] }>`
  - `type BlockSettingsMap` (voir Appendix A pour la liste exhaustive des clés/valeurs).

> **Appendix A** (en fin de plan) contient les valeurs par défaut verbatim et les descripteurs de champs pour les 9 blocs. Les utiliser telles quelles.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `lib/storefront/blockSettings.test.ts` :

```ts
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
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `npx vitest run lib/storefront/blockSettings.test.ts`
Expected : FAIL — `Cannot find module './blockSettings'`.

- [ ] **Step 3 : Implémenter `blockSettings.ts`**

Créer `lib/storefront/blockSettings.ts` avec le contenu de l'**Appendix A**. Structure (extrait — hero ; répliquer le motif pour les 8 autres avec les valeurs de l'Appendix A) :

```ts
import { z } from "zod";
import type { BlockId } from "@/lib/store/useStorefront";

export type FieldKind = "text" | "textarea" | "select" | "toggle" | "number" | "url";

export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
}

/* ---- hero ---- */
export const heroSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  ctaLabel: z.string(),
  ctaLink: z.string(),
  secondaryCtaLabel: z.string(),
  secondaryCtaLink: z.string(),
});
export type HeroSettings = z.infer<typeof heroSchema>;
export const heroDefaults: HeroSettings = {
  eyebrow: "NOUVELLE COLLECTION 2026",
  title: "L'élégance\ntissée main",
  subtitle:
    "Foulards, turbans & accessoires africains pour la femme moderne. Fabriqués en Côte d'Ivoire, dans l'esprit Teranga.",
  ctaLabel: "Découvrir la boutique",
  ctaLink: "/catalogue",
  secondaryCtaLabel: "Notre histoire",
  secondaryCtaLink: "/#ft-story",
};
export const heroFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre (retour à la ligne = nouvelle ligne)", kind: "textarea" },
  { key: "subtitle", label: "Sous-titre", kind: "textarea" },
  { key: "ctaLabel", label: "Bouton principal — libellé", kind: "text" },
  { key: "ctaLink", label: "Bouton principal — lien", kind: "url" },
  { key: "secondaryCtaLabel", label: "Bouton secondaire — libellé", kind: "text" },
  { key: "secondaryCtaLink", label: "Bouton secondaire — lien", kind: "url" },
];

// … story, loyalty, news, contact, cats, grid, featured, look : voir Appendix A …

export const BLOCK_SETTINGS: Record<
  BlockId,
  { schema: z.ZodTypeAny; defaults: unknown; fields: FieldDescriptor[] }
> = {
  hero: { schema: heroSchema, defaults: heroDefaults, fields: heroFields },
  cats: { schema: catsSchema, defaults: catsDefaults, fields: catsFields },
  grid: { schema: gridSchema, defaults: gridDefaults, fields: gridFields },
  loyalty: { schema: loyaltySchema, defaults: loyaltyDefaults, fields: loyaltyFields },
  featured: { schema: featuredSchema, defaults: featuredDefaults, fields: featuredFields },
  story: { schema: storySchema, defaults: storyDefaults, fields: storyFields },
  look: { schema: lookSchema, defaults: lookDefaults, fields: lookFields },
  news: { schema: newsSchema, defaults: newsDefaults, fields: newsFields },
  contact: { schema: contactSchema, defaults: contactDefaults, fields: contactFields },
};
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run : `npx vitest run lib/storefront/blockSettings.test.ts`
Expected : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/storefront/blockSettings.ts lib/storefront/blockSettings.test.ts
git commit -m "feat(storefront): block settings schemas, defaults and field descriptors"
```

---

## Task 3 : Module `pageContent` (schéma page, defaultPage, parse, réducteurs)

**Files:**
- Create: `lib/storefront/pageContent.ts`
- Test: `lib/storefront/pageContent.test.ts`

**Interfaces:**
- Consumes: `BLOCK_SETTINGS` (Task 2) ; `BlockId`, `DEFAULT_BLOCK_ORDER`, `DEFAULT_BLOCK_NAMES` (`@/lib/store/useStorefront`).
- Produces :
  - `interface BlockInstance { type: BlockId; name: string; visible: boolean; settings: Record<string, unknown> }`
  - `interface StorefrontPageContent { blocks: BlockInstance[] }`
  - `pageContentSchema: z.ZodType<StorefrontPageContent>`
  - `defaultPage(): StorefrontPageContent`
  - `parsePageContent(raw: unknown): StorefrontPageContent` (fallback `defaultPage()` si invalide ; filtre les types inconnus)
  - `moveBlock(page, type, dir: -1 | 1): StorefrontPageContent`
  - `setBlockVisible(page, type, visible: boolean): StorefrontPageContent`
  - `renameBlock(page, type, name: string): StorefrontPageContent`
  - `updateBlockSettings(page, type, key: string, value: unknown): StorefrontPageContent`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `lib/storefront/pageContent.test.ts` :

```ts
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
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `npx vitest run lib/storefront/pageContent.test.ts`
Expected : FAIL — `Cannot find module './pageContent'`.

- [ ] **Step 3 : Implémenter `pageContent.ts`**

Créer `lib/storefront/pageContent.ts` :

```ts
import { z } from "zod";
import {
  DEFAULT_BLOCK_ORDER,
  DEFAULT_BLOCK_NAMES,
  type BlockId,
} from "@/lib/store/useStorefront";
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
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run : `npx vitest run lib/storefront/pageContent.test.ts`
Expected : PASS (tous les tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/storefront/pageContent.ts lib/storefront/pageContent.test.ts
git commit -m "feat(storefront): page content schema, defaults, parse fallback and pure reducers"
```

---

## Task 4 : Couche serveur — lecture (`storefrontPage.server`) & Server Actions

**Files:**
- Create: `lib/data/storefrontPage.server.ts`
- Create: `lib/storefront/actions.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db/client`), `getCurrentTenant` (`@/lib/tenant`), `requireZone` (`@/lib/auth`), `defaultPage`/`parsePageContent`/`pageContentSchema` (Task 3).
- Produces :
  - `getPublishedPage(): Promise<StorefrontPageContent>`
  - `getDraftPage(): Promise<StorefrontPageContent>`
  - `saveDraft(content: unknown): Promise<{ ok: true } | { ok: false; error: string }>`
  - `publish(): Promise<{ ok: true } | { ok: false; error: string }>`
  - `revertDraft(): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1 : Implémenter la couche de lecture**

Créer `lib/data/storefrontPage.server.ts` :

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { defaultPage, parsePageContent, type StorefrontPageContent } from "@/lib/storefront/pageContent";

const SLUG = "home";

/** Contenu publié de la vitrine (rendu public). Défaut si aucune ligne. */
export async function getPublishedPage(): Promise<StorefrontPageContent> {
  const tenant = await getCurrentTenant();
  const row = await prisma.storefrontPage.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
  });
  return row ? parsePageContent(row.published) : defaultPage();
}

/** Contenu brouillon (éditeur back-office). Défaut si aucune ligne. */
export async function getDraftPage(): Promise<StorefrontPageContent> {
  const tenant = await getCurrentTenant();
  const row = await prisma.storefrontPage.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
  });
  return row ? parsePageContent(row.draft) : defaultPage();
}
```

- [ ] **Step 2 : Implémenter les Server Actions**

Créer `lib/storefront/actions.ts` :

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { pageContentSchema, parsePageContent, defaultPage } from "./pageContent";

const SLUG = "home";

/** Enregistre le brouillon (autosave). Valide le contenu côté serveur. */
export async function saveDraft(
  content: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = pageContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: "Contenu invalide." };
  const draft = parsePageContent(parsed.data); // normalise (filtre types inconnus)

  try {
    const tenant = await getCurrentTenant();
    await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
      update: { draft },
      create: { tenantId: tenant.id, slug: SLUG, draft, published: defaultPage() },
    });
    revalidatePath("/admin/vitrine");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Publie : copie draft → published. */
export async function publish(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const row = await prisma.storefrontPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
    });
    const draft = row ? row.draft : defaultPage();
    await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
      update: { published: draft, publishedAt: new Date() },
      create: { tenantId: tenant.id, slug: SLUG, draft, published: draft, publishedAt: new Date() },
    });
    revalidatePath("/");
    revalidatePath("/admin/vitrine");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Annule les modifications : copie published → draft. */
export async function revertDraft(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const row = await prisma.storefrontPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
    });
    if (!row) return { ok: true }; // rien à annuler
    await prisma.storefrontPage.update({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
      data: { draft: row.published },
    });
    revalidatePath("/admin/vitrine");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

> `prisma.storefrontPage.upsert` avec `draft`/`published` de type `StorefrontPageContent` : Prisma accepte un objet JSON-sérialisable pour un champ `Json`. Si le typecheck se plaint de la sérialisation, caster via `draft as unknown as Prisma.InputJsonValue` (import `Prisma` depuis `@/lib/generated/prisma/client`).

- [ ] **Step 3 : Vérifier le typecheck**

Run : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add lib/data/storefrontPage.server.ts lib/storefront/actions.ts
git commit -m "feat(storefront): server read layer + saveDraft/publish/revertDraft actions"
```

---

## Task 5 : Renderer commun + branchement Hero & Story ; vitrine publique lit `published`

**Files:**
- Create: `components/storefront/blocks/renderBlock.tsx`
- Modify: `components/storefront/blocks/HeroBlock.tsx`
- Modify: `components/storefront/blocks/StoryBlock.tsx`
- Modify: `components/storefront/HomeShell.tsx`
- Modify: `app/(storefront)/page.tsx`

**Interfaces:**
- Consumes: `BlockInstance` (Task 3), `HeroSettings`/`StorySettings` (Task 2), `Product` (`@/lib/data/types`).
- Produces :
  - `interface BlockRenderContext { products: Product[]; whatsappPhone?: string | null }`
  - `renderBlock(instance: BlockInstance, ctx: BlockRenderContext): React.ReactNode`
  - Composants de blocs acceptant `{ settings }` (typé par bloc).

> Ce chantier introduit le renderer et convertit 2 blocs. Les 7 autres suivent en Tasks 6–7. Tant qu'un bloc n'est pas converti, `renderBlock` lui passe `settings` mais le composant l'ignore encore — aucun crash (rendu identique à aujourd'hui).

- [ ] **Step 1 : Créer le renderer**

Créer `components/storefront/blocks/renderBlock.tsx` :

```tsx
import type { BlockInstance } from "@/lib/storefront/pageContent";
import type { Product } from "@/lib/data/types";
import type {
  HeroSettings, StorySettings, LoyaltySettings, NewsSettings, ContactSettings,
  CatsSettings, GridSettings, FeaturedSettings, LookSettings,
} from "@/lib/storefront/blockSettings";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";
import { FeaturedProductBlock } from "./FeaturedProductBlock";
import { StoryBlock } from "./StoryBlock";
import { LookbookBlock } from "./LookbookBlock";
import { NewsletterBlock } from "./NewsletterBlock";
import { ContactBlock } from "./ContactBlock";

export interface BlockRenderContext {
  products: Product[];
  whatsappPhone?: string | null;
}

/** Mappe un bloc + ses réglages vers son composant, avec narrowing par type. */
export function renderBlock(instance: BlockInstance, ctx: BlockRenderContext): React.ReactNode {
  const { products, whatsappPhone } = ctx;
  switch (instance.type) {
    case "hero":
      return <HeroBlock settings={instance.settings as HeroSettings} />;
    case "cats":
      return <CategoryTilesBlock settings={instance.settings as CatsSettings} products={products} />;
    case "grid":
      return <ProductGridBlock settings={instance.settings as GridSettings} products={products} />;
    case "loyalty":
      return <LoyaltyBannerBlock settings={instance.settings as LoyaltySettings} />;
    case "featured":
      return <FeaturedProductBlock settings={instance.settings as FeaturedSettings} products={products} />;
    case "story":
      return <StoryBlock settings={instance.settings as StorySettings} />;
    case "look":
      return <LookbookBlock settings={instance.settings as LookSettings} />;
    case "news":
      return <NewsletterBlock settings={instance.settings as NewsSettings} />;
    case "contact":
      return <ContactBlock settings={instance.settings as ContactSettings} whatsappPhone={whatsappPhone} />;
    default:
      return null;
  }
}
```

> Les 7 composants encore non convertis accepteront temporairement une prop `settings` inutilisée. Ajouter `settings` à leur signature dès maintenant pour que le typecheck passe (Step 2 pour hero/story ; Tasks 6–7 pour les autres — mais ajouter la prop optionnelle partout ici pour compiler). Pour compiler ce fichier immédiatement, chaque composant doit au minimum déclarer `settings` dans ses props.

- [ ] **Step 2 : Convertir `HeroBlock` pour lire `settings`**

Remplacer `components/storefront/blocks/HeroBlock.tsx` par :

```tsx
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import type { HeroSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function HeroBlock({ settings }: { settings: HeroSettings }) {
  return (
    <BlockFrame id="hero">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ft-store-hero"
            style={{
              position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end",
              background: "repeating-linear-gradient(45deg,#d8ccb8,#d8ccb8 12px,#e2d7c4 12px,#e2d7c4 24px)",
            }}
          >
            <span style={{ position: "absolute", top: 14, left: 16, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>
              visuel hero · 16:9
            </span>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,27,24,.6), rgba(30,27,24,.05) 60%)" }} />
            <div className="ft-store-hero-text" style={{ position: "relative", color: "#fff", maxWidth: 560 }}>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,.5)", borderRadius: 999,
                  font: `600 12px ${fonts.ui}`, letterSpacing: ".06em", marginBottom: 16,
                }}
              >
                {settings.eyebrow}
              </div>
              <h1 className="ft-store-hero-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.04, margin: "0 0 12px" }}>
                {settings.title.split("\n").map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </h1>
              <p className="ft-store-hero-sub" style={{ opacity: 0.92, lineHeight: 1.5, margin: "0 0 22px", maxWidth: 420 }}>
                {settings.subtitle}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={settings.ctaLink} style={{ height: 48, padding: "0 26px", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}>
                  {settings.ctaLabel}
                </Link>
                <Link href={settings.secondaryCtaLink} style={{ height: 48, padding: "0 22px", border: "1.5px solid rgba(255,255,255,.7)", borderRadius: 10, background: "rgba(255,255,255,.08)", color: "#fff", font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}>
                  {settings.secondaryCtaLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 3 : Convertir `StoryBlock` pour lire `settings`**

Remplacer `components/storefront/blocks/StoryBlock.tsx` par (voir Appendix A pour les clés) :

```tsx
import { fonts, colors } from "@/lib/theme/tokens";
import type { StorySettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function StoryBlock({ settings }: { settings: StorySettings }) {
  const stats = [
    { value: settings.stat1Value, label: settings.stat1Label },
    { value: settings.stat2Value, label: settings.stat2Label },
    { value: settings.stat3Value, label: settings.stat3Label },
  ];
  return (
    <BlockFrame id="story">
      <section id="ft-story" style={{ background: "#F4EFE7", borderTop: "1px solid rgba(30,27,24,.06)", borderBottom: "1px solid rgba(30,27,24,.06)" }}>
        <div className="ft-store-section ft-store-story" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", alignItems: "center" }}>
          <div>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 12 }}>
              {settings.eyebrow}
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.12, margin: "0 0 16px", letterSpacing: "-.01em" }}>
              {settings.title}
            </h2>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 14px" }}>{settings.body1}</p>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 20px" }}>{settings.body2}</p>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {stats.map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 30, color: colors.primary }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: colors.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ft-store-story-img" style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "repeating-linear-gradient(45deg,#e0d4c0,#e0d4c0 11px,#ebe1d1 11px,#ebe1d1 22px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>atelier · artisanat</span>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 4 : Ajouter la prop `settings` (inutilisée pour l'instant) aux 7 autres composants**

Pour que `renderBlock.tsx` compile, ajouter la prop à chaque signature **sans changer le rendu** (le branchement réel vient en Tasks 6–7) :
- `CategoryTilesBlock({ settings, products = [] }: { settings: CatsSettings; products?: Product[] })`
- `ProductGridBlock({ settings, products = [] }: { settings: GridSettings; products?: Product[] })`
- `LoyaltyBannerBlock({ settings }: { settings: LoyaltySettings })`
- `FeaturedProductBlock({ settings, products = [] }: { settings: FeaturedSettings; products?: Product[] })`
- `LookbookBlock({ settings }: { settings: LookSettings })`
- `NewsletterBlock({ settings }: { settings: NewsSettings })`
- `ContactBlock({ settings, whatsappPhone }: { settings: ContactSettings; whatsappPhone?: string | null })`

Ajouter l'import de type correspondant en tête de chaque fichier (ex. `import type { CatsSettings } from "@/lib/storefront/blockSettings";`). Préfixer la prop inutilisée d'un `_` OU ajouter `void settings;` en tête du composant pour éviter l'erreur lint « unused ». (Convertis proprement en Tasks 6–7.)

- [ ] **Step 5 : Faire lire `HomeShell` depuis une page fournie + rendre via `renderBlock`**

Remplacer `components/storefront/HomeShell.tsx` par une version qui reçoit `page` + `products` + `whatsappPhone` et n'a **plus aucun état d'édition** :

```tsx
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { renderBlock } from "@/components/storefront/blocks/renderBlock";
import { whatsappLink } from "@/lib/format";
import type { StorefrontPageContent } from "@/lib/storefront/pageContent";
import type { Product } from "@/lib/data/types";

export function HomeShell({
  page,
  products,
  whatsappPhone,
}: {
  page: StorefrontPageContent;
  products: Product[];
  whatsappPhone?: string | null;
}) {
  const visible = page.blocks.filter((b) => b.visible);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {visible.map((b) => (
        <div key={b.type}>{renderBlock(b, { products, whatsappPhone })}</div>
      ))}

      <footer style={{ background: "#1E1B18", color: "#C9BEB0", marginTop: 20 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px 100px", display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22, color: "#fff", marginBottom: 8 }}>Foulard Teranga</div>
            <div style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
              Foulards &amp; accessoires africains élégants, depuis Abidjan.
            </div>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 6 }}>Boutique</div>
            <Link href="/catalogue?cat=Foulards" style={{ color: "#C9BEB0", display: "block" }}>Foulards</Link>
            <Link href="/catalogue?cat=Turbans" style={{ color: "#C9BEB0", display: "block" }}>Turbans</Link>
            <Link href="/catalogue?cat=Accessoires" style={{ color: "#C9BEB0", display: "block" }}>Accessoires</Link>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 6 }}>Aide</div>
            {whatsappPhone ? (
              <a href={whatsappLink(whatsappPhone)} target="_blank" rel="noopener noreferrer" style={{ color: "#C9BEB0", display: "block" }}>WhatsApp</a>
            ) : (
              <div>WhatsApp</div>
            )}
            <div>Livraison</div>
            <div>Points de fidélité</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

> `HomeShell` peut redevenir un composant serveur (plus de hooks). Retirer `"use client"` en tête.

- [ ] **Step 6 : Faire charger la page publiée dans `app/(storefront)/page.tsx`**

Remplacer par :

```tsx
import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { getPublishedPage } from "@/lib/data/storefrontPage.server";
import { HomeShell } from "@/components/storefront/HomeShell";

export default async function StorefrontHomePage() {
  const [products, tenant, page] = await Promise.all([
    getCatalog(),
    getTenantSettings(),
    getPublishedPage(),
  ]);
  return <HomeShell page={page} products={products} whatsappPhone={tenant.phone} />;
}
```

- [ ] **Step 7 : Typecheck + vérification navigateur (vitrine publique inchangée)**

Run : `npx tsc --noEmit` → aucune erreur.
Puis démarrer le serveur de preview (`dev-3002`) et charger `http://localhost:3002/` : la page d'accueil doit être **visuellement identique** à avant (hero « L'élégance tissée main », story, etc.), servie depuis `published`/défaut. Vérifier l'absence d'erreurs console via `read_console_messages`.

- [ ] **Step 8 : Commit**

```bash
git add components/storefront/blocks/renderBlock.tsx components/storefront/blocks/HeroBlock.tsx components/storefront/blocks/StoryBlock.tsx components/storefront/blocks/*.tsx components/storefront/HomeShell.tsx app/\(storefront\)/page.tsx
git commit -m "feat(storefront): settings-driven renderBlock; hero+story wired; public page reads published"
```

---

## Task 6 : Brancher Loyalty, News & Contact sur `settings`

**Files:**
- Modify: `components/storefront/blocks/LoyaltyBannerBlock.tsx`
- Modify: `components/storefront/blocks/NewsletterBlock.tsx`
- Modify: `components/storefront/blocks/ContactBlock.tsx`

**Interfaces:**
- Consumes: `LoyaltySettings`, `NewsSettings`, `ContactSettings` (Task 2).

- [ ] **Step 1 : `LoyaltyBannerBlock` lit `settings`**

Dans `LoyaltyBannerBlock.tsx` : importer `import type { LoyaltySettings } from "@/lib/storefront/blockSettings";`, signature `export function LoyaltyBannerBlock({ settings }: { settings: LoyaltySettings })`, puis remplacer les textes codés en dur :
- `Programme fidélité Teranga` → `{settings.title}`
- `Cumulez des points à chaque commande — 5% offerts dès 300 points.` → `{settings.text}`
- bouton `href="/compte"` → `href={settings.ctaLink}`, libellé `Rejoindre le programme` → `{settings.ctaLabel}`

- [ ] **Step 2 : `NewsletterBlock` lit `settings`**

Dans `NewsletterBlock.tsx` (reste `"use client"`) : importer `NewsSettings`, signature `export function NewsletterBlock({ settings }: { settings: NewsSettings })`, puis :
- `Restez dans la boucle` → `{settings.title}`
- `Nouveautés, ventes privées et 25 points de bienvenue à l'inscription.` → `{settings.text}`
- `placeholder="Votre numéro ou e-mail"` → `placeholder={settings.placeholder}`
- libellé bouton `S'inscrire` → `{settings.buttonLabel}`

- [ ] **Step 3 : `ContactBlock` lit `settings`**

Dans `ContactBlock.tsx` : importer `ContactSettings`, signature `export function ContactBlock({ settings, whatsappPhone }: { settings: ContactSettings; whatsappPhone?: string | null })`, puis :
- `Nous trouver` → `{settings.title}`
- `<ContactRow ... title="Boutique Plateau" body="Rue du Commerce, Plateau, Abidjan · Côte d'Ivoire" />` → `title={settings.locationTitle} body={settings.address}`
- `<ContactRow ... title="Horaires" body="Lun – Sam · 9h – 19h" />` → `title={settings.hoursTitle} body={settings.hours}`
- (le bouton WhatsApp reste piloté par `whatsappPhone` du tenant)

- [ ] **Step 4 : Typecheck + vérification navigateur**

Run : `npx tsc --noEmit` → aucune erreur.
Recharger `http://localhost:3002/` : bandeau fidélité, newsletter et contact identiques à avant.

- [ ] **Step 5 : Commit**

```bash
git add components/storefront/blocks/LoyaltyBannerBlock.tsx components/storefront/blocks/NewsletterBlock.tsx components/storefront/blocks/ContactBlock.tsx
git commit -m "feat(storefront): wire loyalty, newsletter and contact blocks to settings"
```

---

## Task 7 : Brancher Cats, Grid, Featured & Lookbook sur `settings`

**Files:**
- Modify: `components/storefront/blocks/CategoryTilesBlock.tsx`
- Modify: `components/storefront/blocks/ProductGridBlock.tsx`
- Modify: `components/storefront/blocks/FeaturedProductBlock.tsx`
- Modify: `components/storefront/blocks/LookbookBlock.tsx`

**Interfaces:**
- Consumes: `CatsSettings`, `GridSettings`, `FeaturedSettings`, `LookSettings` (Task 2).

- [ ] **Step 1 : `CategoryTilesBlock` — titre de section optionnel**

`CategoryTilesBlock` n'a pas de titre aujourd'hui. Importer `CatsSettings`, signature `({ settings, products = [] }: { settings: CatsSettings; products?: Product[] })`. Ajouter, juste à l'intérieur de `<div className="ft-store-section-tight"><div style={{ maxWidth: 1200, ... }}>`, avant la grille de vignettes :

```tsx
{settings.title.trim() !== "" && (
  <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 14px", letterSpacing: "-.01em" }}>
    {settings.title}
  </h2>
)}
```

(Importer `fonts` depuis `@/lib/theme/tokens` s'il ne l'est pas déjà.) Défaut `title = ""` → aucun titre affiché, zéro régression.

- [ ] **Step 2 : `ProductGridBlock` — titre éditable**

Importer `GridSettings`, signature `({ settings, products = [] }: { settings: GridSettings; products?: Product[] })`. Remplacer le texte `Nouveautés &amp; best-sellers` (ligne du `<h2 className="ft-store-h2">`) par `{settings.title}`.

- [ ] **Step 3 : `FeaturedProductBlock` — pré-titre & libellé bouton éditables**

Importer `FeaturedSettings`, signature `({ settings, products = [] }: { settings: FeaturedSettings; products?: Product[] })`. Remplacer :
- le pré-titre `Édition limitée` → `{settings.eyebrow}`
- le libellé bouton `Voir le produit` → `{settings.ctaLabel}`
(Le titre reste `product.name` — sélection produit reportée.)

- [ ] **Step 4 : `LookbookBlock` — pré-titre & titre éditables**

Importer `LookSettings`, signature `({ settings }: { settings: LookSettings })`. Remplacer :
- `Lookbook` → `{settings.eyebrow}`
- `Portées avec style` → `{settings.title}`

- [ ] **Step 5 : Typecheck + vérification navigateur**

Run : `npx tsc --noEmit` → aucune erreur.
Recharger `http://localhost:3002/` : vignettes (sans titre), grille produits, produit vedette et lookbook identiques à avant. Plus aucun `void settings;`/`_settings` résiduel dans ces 4 fichiers.

- [ ] **Step 6 : Commit**

```bash
git add components/storefront/blocks/CategoryTilesBlock.tsx components/storefront/blocks/ProductGridBlock.tsx components/storefront/blocks/FeaturedProductBlock.tsx components/storefront/blocks/LookbookBlock.tsx
git commit -m "feat(storefront): wire cats, grid, featured and lookbook blocks to settings"
```

---

## Task 8 : Éditeur `/admin/vitrine` (canevas + panneau de réglages + autosave + publier/annuler)

**Files:**
- Create: `app/(dashboard)/vitrine/page.tsx`
- Create: `components/editor/VitrineEditor.tsx`
- Create: `components/editor/BlockSettingsPanel.tsx`
- Create: `components/editor/SettingsField.tsx`
- Modify: `lib/nav.ts` (ajouter l'entrée « Vitrine » + SCREEN_META)

**Interfaces:**
- Consumes: `getDraftPage` (Task 4), `saveDraft`/`publish`/`revertDraft` (Task 4), `renderBlock` (Task 5), réducteurs de `pageContent` (Task 3), `BLOCK_SETTINGS`/`FieldDescriptor` (Task 2), `getCatalog`/`getTenantSettings`.
- Produces: écran d'édition inline WYSIWYG dans la zone dashboard.

- [ ] **Step 1 : Page serveur de la route (zone dashboard, protégée par proxy)**

Créer `app/(dashboard)/vitrine/page.tsx` :

```tsx
import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { getDraftPage } from "@/lib/data/storefrontPage.server";
import { VitrineEditor } from "@/components/editor/VitrineEditor";

export default async function VitrineEditorPage() {
  const [products, tenant, page] = await Promise.all([
    getCatalog(),
    getTenantSettings(),
    getDraftPage(),
  ]);
  return <VitrineEditor initialPage={page} products={products} whatsappPhone={tenant.phone} />;
}
```

- [ ] **Step 2 : Rendu de champ générique**

Créer `components/editor/SettingsField.tsx` :

```tsx
"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import type { FieldDescriptor } from "@/lib/storefront/blockSettings";

export function SettingsField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
      {field.label}
    </label>
  );
  const base: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.borderField}`,
    borderRadius: 9, font: `400 13.5px ${fonts.ui}`, outline: "none",
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {field.kind !== "toggle" && label}
      {field.kind === "textarea" ? (
        <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...base, resize: "vertical" }} />
      ) : field.kind === "select" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base}>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.kind === "toggle" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, font: `600 12px ${fonts.ui}`, color: colors.muted }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      ) : field.kind === "number" ? (
        <input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} style={base} />
      ) : (
        <input type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base} />
      )}
    </div>
  );
}
```

- [ ] **Step 3 : Panneau de réglages d'un bloc**

Créer `components/editor/BlockSettingsPanel.tsx` :

```tsx
"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { BLOCK_SETTINGS } from "@/lib/storefront/blockSettings";
import type { BlockInstance } from "@/lib/storefront/pageContent";
import { SettingsField } from "./SettingsField";

export function BlockSettingsPanel({
  block,
  onChangeSetting,
  onRename,
  onToggleVisible,
  onMove,
}: {
  block: BlockInstance;
  onChangeSetting: (key: string, value: unknown) => void;
  onRename: (name: string) => void;
  onToggleVisible: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const fields = BLOCK_SETTINGS[block.type].fields;
  return (
    <div style={{ padding: "16px 18px" }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, marginBottom: 12 }}>
        Réglages du bloc
      </div>
      <SettingsField field={{ key: "__name", label: "Nom du bloc (interne)", kind: "text" }} value={block.name} onChange={(v) => onRename(String(v))} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => onMove(-1)} style={miniBtn}>↑ Monter</button>
        <button onClick={() => onMove(1)} style={miniBtn}>↓ Descendre</button>
        <button onClick={onToggleVisible} style={miniBtn}>{block.visible ? "Masquer" : "Afficher"}</button>
      </div>
      <div style={{ borderTop: `1px solid ${colors.borderSoft}`, paddingTop: 14 }}>
        {fields.map((f) => (
          <SettingsField key={f.key} field={f} value={block.settings[f.key]} onChange={(v) => onChangeSetting(f.key, v)} />
        ))}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  height: 34, padding: "0 12px", border: `1.5px solid ${colors.borderField}`, borderRadius: 8,
  background: "#fff", color: colors.primary, font: `600 12px ${fonts.ui}`, cursor: "pointer",
};
```

- [ ] **Step 4 : Composant éditeur principal (état, autosave, canevas, barre d'actions)**

Créer `components/editor/VitrineEditor.tsx` :

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { renderBlock } from "@/components/storefront/blocks/renderBlock";
import {
  moveBlock, renameBlock, setBlockVisible, updateBlockSettings,
  type StorefrontPageContent,
} from "@/lib/storefront/pageContent";
import type { BlockId } from "@/lib/store/useStorefront";
import { saveDraft, publish, revertDraft } from "@/lib/storefront/actions";
import { BlockSettingsPanel } from "./BlockSettingsPanel";
import type { Product } from "@/lib/data/types";

type SaveState = "idle" | "saving" | "error";

export function VitrineEditor({
  initialPage,
  products,
  whatsappPhone,
}: {
  initialPage: StorefrontPageContent;
  products: Product[];
  whatsappPhone?: string | null;
}) {
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState<BlockId>(initialPage.blocks[0]?.type ?? "hero");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave débouncé du brouillon à chaque changement de `page`.
  const scheduleSave = useCallback((next: StorefrontPageContent) => {
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      const res = await saveDraft(next);
      setSaveState(res.ok ? "idle" : "error");
    }, 700);
  }, []);

  const apply = useCallback(
    (next: StorefrontPageContent) => {
      setPage(next);
      scheduleSave(next);
    },
    [scheduleSave]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const selectedBlock = page.blocks.find((b) => b.type === selected) ?? page.blocks[0];

  async function onPublish() {
    setPublishing(true);
    // s'assurer que le dernier brouillon est bien enregistré avant publication
    if (timer.current) clearTimeout(timer.current);
    const saved = await saveDraft(page);
    if (!saved.ok) { setSaveState("error"); setPublishing(false); return; }
    await publish();
    setPublishing(false);
  }

  async function onRevert() {
    setPublishing(true);
    await revertDraft();
    setPublishing(false);
    // recharge la page pour récupérer le brouillon = publié
    window.location.reload();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* barre d'actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${colors.borderSoft}`, background: "#fff", position: "sticky", top: 65, zIndex: 20 }}>
        <span style={{ fontSize: 13, color: colors.muted }}>
          {saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Modifications non enregistrées, nouvelle tentative…" : "Brouillon enregistré"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={onRevert} disabled={publishing} style={{ height: 40, padding: "0 16px", border: `1.5px solid ${colors.borderField}`, borderRadius: 9, background: "#fff", color: colors.primary, font: `600 13px ${fonts.ui}`, cursor: publishing ? "default" : "pointer" }}>
            Annuler les modifications
          </button>
          <button onClick={onPublish} disabled={publishing || saveState === "saving"} className="ft-primary-btn" style={{ height: 40, padding: "0 18px", border: "none", borderRadius: 9, background: colors.primary, color: "#fff", font: `700 13px ${fonts.ui}`, cursor: publishing ? "default" : "pointer", opacity: publishing ? 0.7 : 1 }}>
            {publishing ? "Publication…" : "Publier"}
          </button>
        </div>
      </div>

      <div className="ft-editor-cols" style={{ display: "grid", gridTemplateColumns: "1fr 340px", alignItems: "start" }}>
        {/* canevas WYSIWYG (largeur vitrine) */}
        <div style={{ minWidth: 0, overflowX: "hidden" }}>
          {page.blocks.map((b) => (
            <div
              key={b.type}
              onClick={() => setSelected(b.type)}
              style={{
                position: "relative", cursor: "pointer", opacity: b.visible ? 1 : 0.4,
                outline: selected === b.type ? `2px solid ${colors.primary}` : "2px solid transparent",
                outlineOffset: -2,
              }}
            >
              {renderBlock(b, { products, whatsappPhone })}
            </div>
          ))}
        </div>

        {/* panneau de réglages (aside) */}
        <aside style={{ position: "sticky", top: 118, background: "#fff", borderLeft: `1px solid ${colors.borderSoft}`, minHeight: "calc(100vh - 118px)" }}>
          {selectedBlock && (
            <BlockSettingsPanel
              block={selectedBlock}
              onChangeSetting={(key, value) => apply(updateBlockSettings(page, selectedBlock.type, key, value))}
              onRename={(name) => apply(renameBlock(page, selectedBlock.type, name))}
              onToggleVisible={() => apply(setBlockVisible(page, selectedBlock.type, !selectedBlock.visible))}
              onMove={(dir) => apply(moveBlock(page, selectedBlock.type, dir))}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 5 : Ajouter la responsivité du panneau (mobile → sous le canevas)**

Dans `app/globals.css`, ajouter :

```css
/* Éditeur vitrine : deux colonnes (canevas + réglages), empilées sur mobile. */
@media (max-width: 859.98px) {
  .ft-editor-cols {
    grid-template-columns: 1fr !important;
  }
}
```

- [ ] **Step 6 : Ajouter l'entrée de navigation « Vitrine »**

Dans `lib/nav.ts`, ajouter dans `NAV` (après l'entrée `theme`) :

```ts
  { id: "vitrine", href: "/admin/vitrine", label: "Vitrine", short: "Vitrine", icon: ICONS.theme },
```

Ajouter `"vitrine"` à `MORE_ROUTES` :

```ts
export const MORE_ROUTES = ["cust", "mkt", "fin", "theme", "vitrine"];
```

Ajouter dans `SCREEN_META` :

```ts
  "/admin/vitrine": ["Éditeur de vitrine", "Modifiez le contenu de votre page d'accueil"],
```

> `ICONS.theme` est réutilisé faute d'icône dédiée ; remplaçable plus tard.

- [ ] **Step 7 : Autoriser la route dans le proxy (zone dashboard)**

Dans `lib/proxy/zones.ts`, ajouter `"/vitrine"` au tableau `DASHBOARD_PATHS` :

```ts
export const DASHBOARD_PATHS = [
  "/pos",
  "/tableau-de-bord",
  "/commandes",
  "/inventaire",
  "/clientes",
  "/marketing",
  "/finance",
  "/personnalisation",
  "/vitrine",
  "/connexion",
] as const;
```

Vérifier que `lib/proxy/zones.test.ts` passe toujours : `npx vitest run lib/proxy/zones.test.ts`.

- [ ] **Step 8 : Typecheck + vérification navigateur complète (édition → publication)**

Run : `npx tsc --noEmit` → aucune erreur.
Dans le navigateur, connecté en owner :
1. Aller sur `/admin/vitrine` → l'éditeur s'affiche, canevas WYSIWYG + panneau.
2. Sélectionner le bloc Hero, changer le titre → l'aperçu se met à jour ; l'indicateur passe « Enregistrement… » puis « Brouillon enregistré ».
3. Cliquer « Publier ».
4. Ouvrir `/` (vitrine publique) → le nouveau titre apparaît.
5. Vérifier `read_console_messages` : aucune erreur.
Vérifier aussi qu'un utilisateur non connecté sur `/admin/vitrine` est redirigé vers `/admin/connexion` (garde proxy).

- [ ] **Step 9 : Commit**

```bash
git add app/\(dashboard\)/vitrine/ components/editor/ lib/nav.ts lib/proxy/zones.ts app/globals.css
git commit -m "feat(storefront): back-office block editor at /admin/vitrine with autosave + publish/revert"
```

---

## Task 9 : Nettoyage du store public & de l'ancien habillage d'édition inline

**Files:**
- Modify: `lib/store/useStorefront.ts`
- Modify: `components/storefront/blocks/BlockFrame.tsx`

**Interfaces:**
- Produces: `useStorefront` sans état d'édition ; `BlockFrame` réduit à un simple wrapper (plus de mode éditeur client).

- [ ] **Step 1 : Retirer l'état d'édition de `useStorefront`**

Dans `lib/store/useStorefront.ts` :
- Supprimer du type `StorefrontState` : `blocksMode`, `blockOrder`, `blockHidden`, `blockNames`, `toggleBlocksMode`, `moveBlock`, `toggleHideBlock`, `renameBlock`.
- Supprimer les implémentations correspondantes dans le store.
- Retirer ces clés de `partialize` (ne garder que `cart`).
- Conserver `DEFAULT_BLOCK_ORDER`, `DEFAULT_BLOCK_NAMES` et le type `BlockId` (utilisés par `pageContent`/`blockSettings`) — ils restent exportés depuis ce fichier.

- [ ] **Step 2 : Réduire `BlockFrame` à un wrapper inerte**

Le nouvel éditeur gère lui-même la sélection et l'habillage (Task 8), et la vitrine publique ne doit plus contenir aucun code d'édition. Remplacer `components/storefront/blocks/BlockFrame.tsx` par :

```tsx
import type { BlockId } from "@/lib/store/useStorefront";

/** Enveloppe neutre d'un bloc de vitrine. L'habillage d'édition vit désormais
 * exclusivement dans l'éditeur back-office (components/editor), jamais côté public. */
export function BlockFrame({ id, children }: { id: BlockId; children: React.ReactNode }) {
  return <section data-block={id}>{children}</section>;
}
```

- [ ] **Step 3 : Vérifier qu'aucun consommateur des symboles supprimés ne subsiste**

Run :
```bash
grep -rn "blocksMode\|toggleBlocksMode\|toggleHideBlock\|s.blockOrder\|s.blockHidden\|s.blockNames\|renameBlock\|moveBlock" components app lib | grep -v node_modules | grep -v "lib/storefront/pageContent" | grep -v "components/editor"
```
Expected : aucune correspondance (les seuls `renameBlock`/`moveBlock` légitimes sont ceux de `pageContent`/`components/editor`). Corriger tout résidu (ex. anciens imports dans `HomeShell` déjà remplacé en Task 5).

- [ ] **Step 4 : Typecheck + tests + vérification navigateur**

Run : `npx tsc --noEmit` → aucune erreur.
Run : `npx vitest run` → tous les tests passent.
Navigateur : `/` (public) s'affiche normalement, **aucun** cadre pointillé ni barre d'édition, même après avoir visité `/admin/vitrine` dans le même navigateur (le drapeau client d'édition n'existe plus).

- [ ] **Step 5 : Commit**

```bash
git add lib/store/useStorefront.ts components/storefront/blocks/BlockFrame.tsx
git commit -m "refactor(storefront): drop client-side edit state; editing lives only in back-office"
```

---

## Appendix A — Réglages par bloc (valeurs par défaut verbatim + champs)

Pour chaque bloc : le schéma Zod = un `z.object` avec toutes les clés en `z.string()` (sauf indication), les `*Defaults` = les valeurs ci-dessous, les `*Fields` = descripteurs listés. Types exportés : `export type <Block>Settings = z.infer<typeof <block>Schema>`.

### hero (déjà détaillé en Task 2)

### story
Clés (toutes `z.string()`) : `eyebrow, title, body1, body2, stat1Value, stat1Label, stat2Value, stat2Label, stat3Value, stat3Label`.
Defaults :
```
eyebrow: "Notre histoire"
title: "L'esprit Teranga, tissé dans chaque pièce"
body1: "« Teranga », c'est l'hospitalité sénégalaise. Depuis Abidjan, chaque foulard est choisi auprès d'artisanes partenaires, teint à la main selon des savoir-faire transmis de mère en fille."
body2: "Des matières nobles, des motifs qui racontent, une élégance qui vous ressemble."
stat1Value: "100%"   stat1Label: "tissé main"
stat2Value: "24"     stat2Label: "artisanes partenaires"
stat3Value: "3"      stat3Label: "pays livrés"
```
Fields : `eyebrow`(text,"Pré-titre") · `title`(text,"Titre") · `body1`(textarea,"Paragraphe 1") · `body2`(textarea,"Paragraphe 2") · `stat1Value`(text,"Stat 1 — valeur") · `stat1Label`(text,"Stat 1 — libellé") · `stat2Value`(text,"Stat 2 — valeur") · `stat2Label`(text,"Stat 2 — libellé") · `stat3Value`(text,"Stat 3 — valeur") · `stat3Label`(text,"Stat 3 — libellé").

### loyalty
Clés : `title, text, ctaLabel, ctaLink`.
Defaults :
```
title: "Programme fidélité Teranga"
text: "Cumulez des points à chaque commande — 5% offerts dès 300 points."
ctaLabel: "Rejoindre le programme"
ctaLink: "/compte"
```
Fields : `title`(text,"Titre") · `text`(textarea,"Texte") · `ctaLabel`(text,"Bouton — libellé") · `ctaLink`(url,"Bouton — lien").

### news
Clés : `title, text, placeholder, buttonLabel`.
Defaults :
```
title: "Restez dans la boucle"
text: "Nouveautés, ventes privées et 25 points de bienvenue à l'inscription."
placeholder: "Votre numéro ou e-mail"
buttonLabel: "S'inscrire"
```
Fields : `title`(text,"Titre") · `text`(textarea,"Texte") · `placeholder`(text,"Champ — indication") · `buttonLabel`(text,"Bouton — libellé").

### contact
Clés : `title, locationTitle, address, hoursTitle, hours`.
Defaults :
```
title: "Nous trouver"
locationTitle: "Boutique Plateau"
address: "Rue du Commerce, Plateau, Abidjan · Côte d'Ivoire"
hoursTitle: "Horaires"
hours: "Lun – Sam · 9h – 19h"
```
Fields : `title`(text,"Titre") · `locationTitle`(text,"Nom du lieu") · `address`(textarea,"Adresse") · `hoursTitle`(text,"Libellé horaires") · `hours`(text,"Horaires").

### cats
Clés : `title`.
Defaults :
```
title: ""   // titre de section optionnel ; vide = pas de titre (pas de régression)
```
Fields : `title`(text,"Titre de section (optionnel)").

### grid
Clés : `title`.
Defaults :
```
title: "Nouveautés & best-sellers"
```
Fields : `title`(text,"Titre de section").

### featured
Clés : `eyebrow, ctaLabel`.
Defaults :
```
eyebrow: "Édition limitée"
ctaLabel: "Voir le produit"
```
Fields : `eyebrow`(text,"Pré-titre") · `ctaLabel`(text,"Bouton — libellé").

### look
Clés : `eyebrow, title`.
Defaults :
```
eyebrow: "Lookbook"
title: "Portées avec style"
```
Fields : `eyebrow`(text,"Pré-titre") · `title`(text,"Titre").

---

## Self-Review (effectuée)

- **Couverture spec :** table `StorefrontPage`+RLS (T1) ✓ · registry schémas/défauts/champs (T2) ✓ · pageContent + réducteurs (T3) ✓ · data layer + actions gardées (T4) ✓ · renderer + 9 blocs branchés (T5–T7) ✓ · route `/admin/vitrine` protégée + autosave + publier/annuler (T8) ✓ · nettoyage store public + fin du risque résiduel (T9) ✓ · périmètre texte-only, images/richtext/repeater reportés ✓.
- **Placeholders :** aucun « TBD/TODO » ; toutes les valeurs par défaut sont fournies verbatim (Appendix A) ; code complet à chaque step de code.
- **Cohérence des types :** `renderBlock(instance, ctx)`, `saveDraft(content)`, `publish()`, `revertDraft()`, réducteurs `moveBlock/setBlockVisible/renameBlock/updateBlockSettings`, `getPublishedPage/getDraftPage` — noms/signatures identiques entre définition (T3/T4) et usage (T5/T8).
- **Adaptation testing :** le projet n'ayant ni harness DB ni Playwright, les tests automatisés portent sur la logique pure (T2, T3) ; RLS vérifiée via Supabase advisors (T1) ; persistance/édition vérifiées via le navigateur de preview (T5–T8). Écart assumé vs « test RLS/E2E » du spec, justifié par l'absence d'infra de test correspondante.
