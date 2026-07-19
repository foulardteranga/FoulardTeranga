# Storefront Image Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à la gérante d'uploader/remplacer, depuis l'éditeur `/admin/vitrine`, les images de 4 champs aujourd'hui non éditables (`hero.backgroundImage`, `story.image`, les 3 vignettes de `cats`, la galerie `look`), stockées sur Supabase Storage, compressées côté serveur, sans jamais écrire de code.

**Architecture:** Un bucket Supabase Storage partagé (`storefront-images`, public en lecture) avec des chemins préfixés `<tenantId>/...`, gardé par des policies RLS réutilisant les helpers `current_tenant_id()`/`current_role()` déjà en place. Deux nouveaux `FieldKind` (`image`, `imageList`) étendent le registry existant (`lib/storefront/blockSettings.ts`) : la valeur est l'URL publique complète (ou un tableau d'URLs), stockée dans le même JSON `settings` que les champs texte. Une nouvelle Server Action `uploadBlockImage` (gardée `requireZone("dashboard")`, comme `saveDraft`/`publish`/`revertDraft`) reçoit le fichier, le valide, le compresse via `sharp` (redimensionnement + conversion WebP), l'upload avec le client Supabase serveur (cookies, jamais `service_role`), et renvoie l'URL publique — qui repasse ensuite par le circuit d'autosave existant, sans nouveau mécanisme de sauvegarde.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), React 19.2, TypeScript strict, Supabase Storage + `@supabase/ssr`, `sharp` (nouvelle dépendance), Zod v4, Vitest.

## Global Constraints

- TypeScript strict ; **jamais** de `any` (préférer `unknown` + narrowing).
- Server Components par défaut ; `"use client"` seulement si interactivité ; mutations via Server Actions.
- Accès données **côté serveur uniquement** ; jamais de `service_role` ni requête privilégiée côté client.
- Résultats typés `{ ok: true, ... } | { ok: false, error: string }` pour les Server Actions ; pas d'exception silencieuse.
- Toute nouvelle ressource de stockage → migration SQL **+** policy RLS **+** vérification (ici : Supabase advisors, pas de harness de test DB — DB gérée par Supabase MCP, **pas** `prisma migrate deploy`, cf. `.superpowers/sdd/progress.md` §Plan 3).
- Langue produit : FR (contenu, libellés UI). Code/identifiants : EN.
- Tests = Vitest sur logique pure (`*.test.ts`, `environment: node`). Pas de Playwright (non installé). Vérification runtime via le navigateur de preview.
- Bucket `storefront-images` : lecture publique, écriture réservée à `owner`/`staff` du tenant du chemin. Formats acceptés : `image/jpeg`, `image/png`, `image/webp`. Taille brute max 10 Mo. Compression serveur : largeur max 1920px (pas d'agrandissement), WebP qualité 82.
- `cats` reste sur 3 catégories fixes (Foulards/Turbans/Accessoires) — pas de repeater. `look` gagne un `imageList` (ajout/retrait/réordonnancement par flèches ↑/↓, pas de `@dnd-kit`).
- Dette acceptée : pas de nettoyage des fichiers orphelins en Storage (v1), pas de repeater complet pour `cats`, pas de légendes par image dans `look`.

---

## Task 1 : Bucket Supabase Storage + RLS

**Files:**
- Create: `prisma/migrations/20260717090000_storefront_images_storage/migration.sql`
- Verify: via Supabase MCP (`execute_sql`, `get_advisors`)

**Interfaces:**
- Produces: bucket Storage `storefront-images` (public, `file_size_limit=10485760`, `allowed_mime_types` JPEG/PNG/WebP), policies `storefront_images_select_public` (lecture publique) et `storefront_images_write_staff` (écriture owner/staff du tenant propriétaire du dossier).

- [ ] **Step 1 : Écrire la migration SQL**

Créer `prisma/migrations/20260717090000_storefront_images_storage/migration.sql` :

```sql
-- Bucket public pour les images éditables de la vitrine (hero, story, cats,
-- lookbook), compressées côté serveur avant upload (lib/storefront/imageUpload.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'storefront-images',
  'storefront-images',
  true,
  10485760, -- 10 Mo, aligné sur MAX_UPLOAD_BYTES côté serveur
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS : lecture publique (images décoratives, non sensibles), écriture
-- réservée à owner/staff du tenant propriétaire du dossier (premier segment
-- du chemin = tenantId). Réutilise les helpers de la migration 20260713120100_rls.
create policy "storefront_images_select_public"
on storage.objects for select
using (bucket_id = 'storefront-images');

create policy "storefront_images_write_staff"
on storage.objects for all
using (
  bucket_id = 'storefront-images'
  and (storage.foldername(name))[1] = public.current_tenant_id()
  and public.current_role() in ('owner', 'staff')
)
with check (
  bucket_id = 'storefront-images'
  and (storage.foldername(name))[1] = public.current_tenant_id()
  and public.current_role() in ('owner', 'staff')
);
```

- [ ] **Step 2 : Appliquer la migration via le MCP Supabase**

Utiliser l'outil MCP Supabase `apply_migration` avec :
- `name`: `storefront_images_storage`
- `query`: le contenu SQL du Step 1

Expected : la migration s'applique sans erreur.

- [ ] **Step 3 : Vérifier le bucket et les policies**

Utiliser l'outil MCP Supabase `execute_sql` :

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'storefront-images';
```

Expected : une ligne, `public = true`, `file_size_limit = 10485760`, `allowed_mime_types = {image/jpeg,image/png,image/webp}`.

```sql
select policyname
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'storefront_images%'
order by policyname;
```

Expected : exactement 2 lignes, `storefront_images_select_public` et `storefront_images_write_staff`.

- [ ] **Step 4 : Vérifier via Supabase advisors**

Utiliser l'outil MCP Supabase `get_advisors` (type `security`).

Expected : aucun nouvel advisor lié à `storage.objects` ou au bucket `storefront-images`.

- [ ] **Step 5 : Commit**

```bash
git add prisma/migrations/20260717090000_storefront_images_storage/
git commit -m "feat(storefront): add storefront-images Storage bucket with RLS"
```

---

## Task 2 : Dépendance `sharp` + configuration `next/image`

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `sharp` disponible comme dépendance de production ; `next/image` autorisé à servir des images depuis l'hôte Supabase Storage du projet.

- [ ] **Step 1 : Ajouter `sharp` aux dépendances**

Dans `package.json`, dans le bloc `"dependencies"`, ajouter `sharp` après `"react-dom"` (ordre alphabétique) :

```json
    "react-dom": "19.2.0",
    "sharp": "^0.35.3",
    "zod": "^4.4.3",
```

- [ ] **Step 2 : Installer**

Run : `npm install`
Expected : `sharp` apparaît dans `package-lock.json`, installation sans erreur (télécharge le binaire natif correspondant à la plateforme).

- [ ] **Step 3 : Autoriser l'hôte Supabase Storage dans `next/image`**

Remplacer le contenu de `next.config.ts` par :

```ts
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// next.config.ts s'exécute avant que Next.js ne charge automatiquement les
// fichiers .env pour le reste de l'app — on les charge nous-mêmes pour lire
// NEXT_PUBLIC_SUPABASE_URL ici.
loadEnvConfig(process.cwd());

const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/storefront-images/**",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4 : Vérifier que la configuration compile**

Run : `npx tsc --noEmit`
Expected : aucune erreur (le fichier est inclus par `tsconfig.json` via `**/*.ts`).

- [ ] **Step 5 : Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore(storefront): add sharp and allow Supabase Storage images in next/image"
```

---

## Task 3 : Validation & compression d'images (`lib/storefront/imageUpload.ts`)

**Files:**
- Create: `lib/storefront/imageUpload.ts`
- Test: `lib/storefront/imageUpload.test.ts`

**Interfaces:**
- Produces:
  - `STOREFRONT_IMAGES_BUCKET: string` — nom du bucket Supabase Storage (`"storefront-images"`).
  - `MAX_UPLOAD_BYTES: number` — limite de taille brute (10 Mo).
  - `validateImageUpload(file: { type: string; size: number }): { ok: true } | { ok: false; error: string }`.
  - `compressImage(input: Buffer): Promise<Buffer>` — redimensionne (max 1920px de large, pas d'agrandissement) et convertit en WebP qualité 82.

- [ ] **Step 1 : Écrire les tests de `validateImageUpload`**

Créer `lib/storefront/imageUpload.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateImageUpload, compressImage, MAX_UPLOAD_BYTES } from "./imageUpload";

describe("validateImageUpload", () => {
  it("accepte un JPEG, un PNG et un WebP sous la limite de taille", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: 1000 })).toEqual({ ok: true });
    expect(validateImageUpload({ type: "image/png", size: 1000 })).toEqual({ ok: true });
    expect(validateImageUpload({ type: "image/webp", size: 1000 })).toEqual({ ok: true });
  });

  it("rejette un format non supporté", () => {
    const result = validateImageUpload({ type: "application/pdf", size: 1000 });
    expect(result.ok).toBe(false);
  });

  it("rejette un fichier au-dessus de la limite de taille", () => {
    const result = validateImageUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 });
    expect(result.ok).toBe(false);
  });

  it("accepte un fichier exactement à la limite de taille", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES })).toEqual({ ok: true });
  });
});

describe("compressImage", () => {
  it("convertit une image en WebP", async () => {
    const input = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
  });

  it("redimensionne une image plus large que 1920px à 1920px de large", async () => {
    const input = await sharp({
      create: { width: 2500, height: 500, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(1920);
  });

  it("n'agrandit pas une image plus petite que 1920px", async () => {
    const input = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .png()
      .toBuffer();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(50);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

Run : `npx vitest run lib/storefront/imageUpload.test.ts`
Expected : FAIL — `Cannot find module './imageUpload'` (le fichier n'existe pas encore).

- [ ] **Step 3 : Implémenter `lib/storefront/imageUpload.ts`**

```ts
import sharp from "sharp";

export const STOREFRONT_IMAGES_BUCKET = "storefront-images";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo brut, avant compression

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

export function validateImageUpload(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return { ok: false, error: "Format non supporté (JPEG, PNG ou WebP uniquement)." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (10 Mo maximum)." };
  }
  return { ok: true };
}

/** Redimensionne (largeur max 1920px, pas d'agrandissement) et convertit en WebP. */
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(MAX_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

Run : `npx vitest run lib/storefront/imageUpload.test.ts`
Expected : `7 passed`.

- [ ] **Step 5 : Commit**

```bash
git add lib/storefront/imageUpload.ts lib/storefront/imageUpload.test.ts
git commit -m "feat(storefront): add image validation and server-side compression"
```

---

## Task 4 : Server Action `uploadBlockImage`

**Files:**
- Modify: `lib/storefront/actions.ts`
- Test: `lib/storefront/actions.test.ts`

**Interfaces:**
- Consumes: `validateImageUpload`, `compressImage`, `STOREFRONT_IMAGES_BUCKET` (Task 3) ; `requireZone` (`@/lib/auth`) ; `getCurrentTenant` (`@/lib/tenant`) ; `createClient` (`@/lib/supabase/server`).
- Produces: `uploadBlockImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }>`. `formData` attend les clés `file` (File), `blockType` (string), `fieldKey` (string).

- [ ] **Step 1 : Écrire le test du garde-fou `requireZone`**

Créer `lib/storefront/actions.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireZone: async () => ({ allowed: false }),
}));

import { uploadBlockImage } from "./actions";

describe("uploadBlockImage", () => {
  it("rejette hors zone dashboard", async () => {
    const formData = new FormData();
    formData.append("blockType", "hero");
    formData.append("fieldKey", "backgroundImage");

    const res = await uploadBlockImage(formData);

    expect(res).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run : `npx vitest run lib/storefront/actions.test.ts`
Expected : FAIL — `uploadBlockImage is not a function` (l'export n'existe pas encore).

- [ ] **Step 3 : Implémenter `uploadBlockImage` dans `lib/storefront/actions.ts`**

En haut du fichier, à la suite des imports existants (après `import { pageContentSchema, parsePageContent, defaultPage } from "./pageContent";`), ajouter :

```ts
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "./imageUpload";
```

À la fin du fichier (après `revertDraft`), ajouter :

```ts

/** Upload une image de bloc vers Supabase Storage, compressée côté serveur. */
export async function uploadBlockImage(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const file = formData.get("file");
  const blockType = formData.get("blockType");
  const fieldKey = formData.get("fieldKey");
  if (!(file instanceof File) || typeof blockType !== "string" || typeof fieldKey !== "string") {
    return { ok: false, error: "Requête invalide." };
  }

  const validation = validateImageUpload(file);
  if (!validation.ok) return validation;

  try {
    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(raw);
    const tenant = await getCurrentTenant();
    const path = `${tenant.id}/${blockType}/${fieldKey}-${randomUUID()}.webp`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(STOREFRONT_IMAGES_BUCKET)
      .upload(path, compressed, { contentType: "image/webp", upsert: false });
    if (uploadError) return { ok: false, error: "Une erreur est survenue, réessayez." };

    const { data } = supabase.storage.from(STOREFRONT_IMAGES_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run : `npx vitest run lib/storefront/actions.test.ts`
Expected : `1 passed`.

- [ ] **Step 5 : Typecheck**

Run : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add lib/storefront/actions.ts lib/storefront/actions.test.ts
git commit -m "feat(storefront): add uploadBlockImage server action"
```

---

## Task 5 : Champs image dans le registry (`blockSettings.ts`)

**Files:**
- Modify: `lib/storefront/blockSettings.ts`
- Modify: `lib/storefront/blockSettings.test.ts`

**Interfaces:**
- Produces: `FieldKind` étendu avec `"image" | "imageList"` ; `HeroSettings.backgroundImage: string` ; `StorySettings.image: string` ; `CatsSettings.foulardsImage/turbansImage/accessoiresImage: string` ; `LookSettings.images: string[]`.

- [ ] **Step 1 : Étendre `FieldKind`**

Dans `lib/storefront/blockSettings.ts`, remplacer :

```ts
export type FieldKind = "text" | "textarea" | "select" | "toggle" | "number" | "url";
```

par :

```ts
export type FieldKind =
  | "text" | "textarea" | "select" | "toggle" | "number" | "url"
  | "image" | "imageList";
```

- [ ] **Step 2 : `hero.backgroundImage`**

Remplacer le bloc `hero` (schema/defaults/fields) :

```ts
/* ---- hero ---- */
export const heroSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  ctaLabel: z.string(),
  ctaLink: z.string(),
  secondaryCtaLabel: z.string(),
  secondaryCtaLink: z.string(),
  backgroundImage: z.string(),
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
  backgroundImage: "",
};
export const heroFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre (retour à la ligne = nouvelle ligne)", kind: "textarea" },
  { key: "subtitle", label: "Sous-titre", kind: "textarea" },
  { key: "ctaLabel", label: "Bouton principal — libellé", kind: "text" },
  { key: "ctaLink", label: "Bouton principal — lien", kind: "url" },
  { key: "secondaryCtaLabel", label: "Bouton secondaire — libellé", kind: "text" },
  { key: "secondaryCtaLink", label: "Bouton secondaire — lien", kind: "url" },
  { key: "backgroundImage", label: "Image de fond", kind: "image" },
];
```

- [ ] **Step 3 : `story.image`**

Remplacer le bloc `story` (schema/defaults/fields) :

```ts
/* ---- story ---- */
export const storySchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  body1: z.string(),
  body2: z.string(),
  stat1Value: z.string(),
  stat1Label: z.string(),
  stat2Value: z.string(),
  stat2Label: z.string(),
  stat3Value: z.string(),
  stat3Label: z.string(),
  image: z.string(),
});
export type StorySettings = z.infer<typeof storySchema>;
export const storyDefaults: StorySettings = {
  eyebrow: "Notre histoire",
  title: "L'esprit Teranga, tissé dans chaque pièce",
  body1:
    "« Teranga », c'est l'hospitalité sénégalaise. Depuis Abidjan, chaque foulard est choisi auprès d'artisanes partenaires, teint à la main selon des savoir-faire transmis de mère en fille.",
  body2: "Des matières nobles, des motifs qui racontent, une élégance qui vous ressemble.",
  stat1Value: "100%",
  stat1Label: "tissé main",
  stat2Value: "24",
  stat2Label: "artisanes partenaires",
  stat3Value: "3",
  stat3Label: "pays livrés",
  image: "",
};
export const storyFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre", kind: "text" },
  { key: "body1", label: "Paragraphe 1", kind: "textarea" },
  { key: "body2", label: "Paragraphe 2", kind: "textarea" },
  { key: "stat1Value", label: "Stat 1 — valeur", kind: "text" },
  { key: "stat1Label", label: "Stat 1 — libellé", kind: "text" },
  { key: "stat2Value", label: "Stat 2 — valeur", kind: "text" },
  { key: "stat2Label", label: "Stat 2 — libellé", kind: "text" },
  { key: "stat3Value", label: "Stat 3 — valeur", kind: "text" },
  { key: "stat3Label", label: "Stat 3 — libellé", kind: "text" },
  { key: "image", label: "Photo atelier", kind: "image" },
];
```

- [ ] **Step 4 : `cats.foulardsImage` / `turbansImage` / `accessoiresImage`**

Remplacer le bloc `cats` (schema/defaults/fields) :

```ts
/* ---- cats ---- */
export const catsSchema = z.object({
  title: z.string(),
  foulardsImage: z.string(),
  turbansImage: z.string(),
  accessoiresImage: z.string(),
});
export type CatsSettings = z.infer<typeof catsSchema>;
export const catsDefaults: CatsSettings = {
  // titre de section optionnel ; vide = pas de titre (pas de régression)
  title: "",
  foulardsImage: "",
  turbansImage: "",
  accessoiresImage: "",
};
export const catsFields: FieldDescriptor[] = [
  { key: "title", label: "Titre de section (optionnel)", kind: "text" },
  { key: "foulardsImage", label: "Image — Foulards", kind: "image" },
  { key: "turbansImage", label: "Image — Turbans", kind: "image" },
  { key: "accessoiresImage", label: "Image — Accessoires", kind: "image" },
];
```

- [ ] **Step 5 : `look.images`**

Remplacer le bloc `look` (schema/defaults/fields) :

```ts
/* ---- look ---- */
export const lookSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  images: z.array(z.string()),
});
export type LookSettings = z.infer<typeof lookSchema>;
export const lookDefaults: LookSettings = {
  eyebrow: "Lookbook",
  title: "Portées avec style",
  images: [],
};
export const lookFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre", kind: "text" },
  { key: "images", label: "Galerie", kind: "imageList" },
];
```

- [ ] **Step 6 : Ajouter les tests de couverture des nouveaux champs**

Dans `lib/storefront/blockSettings.test.ts`, ajouter l'import des champs et un nouveau bloc `describe` à la fin du fichier :

```ts
import { BLOCK_SETTINGS, heroFields, storyFields, catsFields, lookFields } from "./blockSettings";
```

(remplace la ligne d'import existante `import { BLOCK_SETTINGS } from "./blockSettings";`)

```ts

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
```

- [ ] **Step 7 : Lancer les tests, vérifier qu'ils passent**

Run : `npx vitest run lib/storefront/blockSettings.test.ts`
Expected : `5 passed` (les 3 tests existants + les 2 nouveaux).

- [ ] **Step 8 : Typecheck**

Run : `npx tsc --noEmit`
Expected : des erreurs apparaîtront dans `HeroBlock.tsx`/`StoryBlock.tsx`/`CategoryTilesBlock.tsx`/`LookbookBlock.tsx`/`renderBlock.tsx` **non** — ces fichiers utilisent déjà `settings` en accès dynamique par clé (`instance.settings as HeroSettings` etc.) donc l'ajout de champs ne casse rien côté render tant que Task 7 n'est pas encore là. Expected réel : aucune erreur.

- [ ] **Step 9 : Commit**

```bash
git add lib/storefront/blockSettings.ts lib/storefront/blockSettings.test.ts
git commit -m "feat(storefront): add image/imageList fields to hero, story, cats, look"
```

---

## Task 6 : Champs image dans l'éditeur (`SettingsField.tsx`)

**Files:**
- Modify: `components/editor/SettingsField.tsx`
- Modify: `components/editor/BlockSettingsPanel.tsx`

**Interfaces:**
- Consumes: `uploadBlockImage` (Task 4), `FieldDescriptor`/`FieldKind` (Task 5), `BlockId` (`@/lib/storefront/blockIds`).
- Produces: `SettingsField` accepte une nouvelle prop requise `blockType: BlockId` ; rend un uploader pour `kind: "image"` et `kind: "imageList"`.

- [ ] **Step 1 : Remplacer `components/editor/SettingsField.tsx`**

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import type { FieldDescriptor } from "@/lib/storefront/blockSettings";
import type { BlockId } from "@/lib/storefront/blockIds";
import { uploadBlockImage } from "@/lib/storefront/actions";

const miniBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 34, padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`, borderRadius: 8, background: "#fff",
  color: colors.primary, font: `600 12px ${fonts.ui}`,
};

const tinyBtnStyle: React.CSSProperties = {
  height: 26, padding: "0 8px", border: `1.5px solid ${colors.borderField}`, borderRadius: 6,
  background: "#fff", color: colors.primary, font: `600 11px ${fonts.ui}`, cursor: "pointer",
};

function moveItem(arr: string[], from: number, to: number): string[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function SettingsField({
  field,
  value,
  onChange,
  blockType,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  blockType: BlockId;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadAndApply(file: File, apply: (url: string) => void) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("blockType", blockType);
    formData.append("fieldKey", field.key);
    const res = await uploadBlockImage(formData);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    apply(res.url);
  }

  const label = (
    <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
      {field.label}
    </label>
  );
  const base: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.borderField}`,
    borderRadius: 9, font: `400 13.5px ${fonts.ui}`, outline: "none",
  };

  if (field.kind === "image") {
    const url = typeof value === "string" ? value : "";
    return (
      <div style={{ marginBottom: 14 }}>
        {label}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 9, marginBottom: 8 }} />
        ) : (
          <div style={{ width: "100%", height: 90, border: `1.5px dashed ${colors.borderField}`, borderRadius: 9, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: colors.muted }}>
            Aucune image
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
            {uploading ? "Envoi…" : url ? "Remplacer" : "Choisir une image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadAndApply(f, (u) => onChange(u));
              }}
              style={{ display: "none" }}
            />
          </label>
          {url && (
            <button type="button" onClick={() => onChange("")} disabled={uploading} style={miniBtnStyle}>
              Retirer
            </button>
          )}
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
      </div>
    );
  }

  if (field.kind === "imageList") {
    const urls = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div style={{ marginBottom: 14 }}>
        {label}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {urls.map((src, i) => (
            <div key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 9 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <button type="button" onClick={() => onChange(moveItem(urls, i, i - 1))} disabled={i === 0} style={tinyBtnStyle}>↑</button>
                <button type="button" onClick={() => onChange(moveItem(urls, i, i + 1))} disabled={i === urls.length - 1} style={tinyBtnStyle}>↓</button>
                <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))} style={tinyBtnStyle}>Retirer</button>
              </div>
            </div>
          ))}
        </div>
        <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
          {uploading ? "Envoi…" : "Ajouter une image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) uploadAndApply(f, (u) => onChange([...urls, u]));
            }}
            style={{ display: "none" }}
          />
        </label>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
      </div>
    );
  }

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

- [ ] **Step 2 : Passer `blockType` depuis `BlockSettingsPanel.tsx`**

Dans `components/editor/BlockSettingsPanel.tsx`, remplacer les deux usages de `<SettingsField ... />` :

```tsx
      <SettingsField field={{ key: "__name", label: "Nom du bloc (interne)", kind: "text" }} value={block.name} onChange={(v) => onRename(String(v))} blockType={block.type} />
```

et

```tsx
        {fields.map((f) => (
          <SettingsField key={f.key} field={f} value={block.settings[f.key]} onChange={(v) => onChangeSetting(f.key, v)} blockType={block.type} />
        ))}
```

- [ ] **Step 3 : Typecheck**

Run : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 4 : Vérification visuelle rapide**

Run : `npm run dev -- --webpack` (ou via le navigateur de preview), ouvrir `/admin/vitrine`, sélectionner le bloc « Bandeau Hero ».
Expected : le panneau de réglages affiche un champ « Image de fond » avec un bouton « Choisir une image » et une zone « Aucune image » (pas d'image encore uploadée). Pas d'erreur console.

- [ ] **Step 5 : Commit**

```bash
git add components/editor/SettingsField.tsx components/editor/BlockSettingsPanel.tsx
git commit -m "feat(storefront): add image and imageList upload UI to the settings panel"
```

---

## Task 7 : Rendu des images dans les blocs publics

**Files:**
- Modify: `components/storefront/blocks/HeroBlock.tsx`
- Modify: `components/storefront/blocks/StoryBlock.tsx`
- Modify: `components/storefront/blocks/CategoryTilesBlock.tsx`
- Modify: `components/storefront/blocks/LookbookBlock.tsx`

**Interfaces:**
- Consumes: `HeroSettings.backgroundImage`, `StorySettings.image`, `CatsSettings.foulardsImage/turbansImage/accessoiresImage`, `LookSettings.images` (Task 5).
- Produces: chaque bloc affiche l'image uploadée via `next/image` quand elle est renseignée, sinon conserve le placeholder décoratif existant à l'identique (zéro régression visuelle sur une boutique sans images).

- [ ] **Step 1 : `HeroBlock.tsx`**

Remplacer tout le fichier :

```tsx
import Image from "next/image";
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
              background: settings.backgroundImage
                ? undefined
                : "repeating-linear-gradient(45deg,#d8ccb8,#d8ccb8 12px,#e2d7c4 12px,#e2d7c4 24px)",
            }}
          >
            {settings.backgroundImage ? (
              <Image src={settings.backgroundImage} alt="" fill sizes="100vw" style={{ objectFit: "cover" }} priority />
            ) : (
              <span style={{ position: "absolute", top: 14, left: 16, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>
                visuel hero · 16:9
              </span>
            )}
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

- [ ] **Step 2 : `StoryBlock.tsx`**

Remplacer tout le fichier :

```tsx
import Image from "next/image";
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
          <div
            className="ft-store-story-img"
            style={{
              position: "relative", borderRadius: 16, overflow: "hidden",
              background: settings.image ? undefined : "repeating-linear-gradient(45deg,#e0d4c0,#e0d4c0 11px,#ebe1d1 11px,#ebe1d1 22px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {settings.image ? (
              <Image src={settings.image} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>atelier · artisanat</span>
            )}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 3 : `CategoryTilesBlock.tsx`**

Remplacer tout le fichier :

```tsx
import Image from "next/image";
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { storefrontCategories } from "@/lib/data/catalog";
import type { Product } from "@/lib/data/types";
import type { CatsSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

const TILE_COLOR: Record<string, string> = {
  Foulards: "#26326B",
  Turbans: "#D07A34",
  Accessoires: "#C9A227",
};

const CATEGORY_IMAGE_KEY: Record<string, keyof CatsSettings> = {
  Foulards: "foulardsImage",
  Turbans: "turbansImage",
  Accessoires: "accessoiresImage",
};

export function CategoryTilesBlock({ settings, products = [] }: { settings: CatsSettings; products?: Product[] }) {
  return (
    <BlockFrame id="cats">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {settings.title.trim() !== "" && (
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 14px", letterSpacing: "-.01em" }}>
              {settings.title}
            </h2>
          )}
          <div className="ft-store-cats" style={{ display: "grid", gap: 14 }}>
            {storefrontCategories.map((cat) => {
              const count = products.filter((p) => p.cat === cat).length;
              const imageUrl = settings[CATEGORY_IMAGE_KEY[cat]];
              return (
                <Link
                  key={cat}
                  href={`/catalogue?cat=${encodeURIComponent(cat)}`}
                  style={{
                    position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "4 / 3",
                    background: imageUrl ? undefined : stripe(TILE_COLOR[cat]), display: "block",
                  }}
                >
                  {imageUrl && (
                    <Image src={imageUrl} alt="" fill sizes="(max-width: 900px) 50vw, 33vw" style={{ objectFit: "cover" }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,27,24,.5), transparent 65%)" }} />
                  <div style={{ position: "absolute", left: 16, bottom: 14, color: "#fff" }}>
                    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22 }}>{cat}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.9 }}>{count} modèles →</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 4 : `LookbookBlock.tsx`**

Remplacer tout le fichier :

```tsx
import Image from "next/image";
import { fonts, colors } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import type { LookSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

const LOOKS = [
  { label: "look 01 · 3:4", hex: "#26326B" },
  { label: "look 02 · 3:4", hex: "#D07A34" },
  { label: "look 03 · 3:4", hex: "#C9A227" },
  { label: "look 04 · 3:4", hex: "#0E9F6E" },
];

export function LookbookBlock({ settings }: { settings: LookSettings }) {
  return (
    <BlockFrame id="look">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 6 }}>
              {settings.eyebrow}
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
              {settings.title}
            </h2>
          </div>
          <div className="ft-store-look-grid" style={{ display: "grid", gap: 12 }}>
            {settings.images.length > 0
              ? settings.images.map((src, i) => (
                  <div key={src + i} style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "3 / 4" }}>
                    <Image src={src} alt="" fill sizes="(max-width: 900px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                  </div>
                ))
              : LOOKS.map((look) => (
                  <div
                    key={look.label}
                    style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "3 / 4", background: stripe(look.hex), display: "flex", alignItems: "flex-end", padding: 12 }}
                  >
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: "#9a8f7d" }}>{look.label}</span>
                  </div>
                ))}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 5 : Lancer toute la suite Vitest**

Run : `npx vitest run`
Expected : tous les tests passent (aucune régression sur `pageContent.test.ts`, `blockSettings.test.ts`, etc.).

- [ ] **Step 6 : Typecheck**

Run : `npx tsc --noEmit`
Expected : aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add components/storefront/blocks/HeroBlock.tsx components/storefront/blocks/StoryBlock.tsx components/storefront/blocks/CategoryTilesBlock.tsx components/storefront/blocks/LookbookBlock.tsx
git commit -m "feat(storefront): render uploaded images in hero, story, cats, look blocks"
```

---

## Task 8 : Vérification bout-en-bout dans le navigateur

**Files:** aucun (vérification uniquement)

- [ ] **Step 1 : Lancer la suite complète et le typecheck**

Run : `npm run test && npx tsc --noEmit`
Expected : tous les tests passent, aucune erreur de type.

- [ ] **Step 2 : Lancer le serveur de dev et ouvrir l'éditeur**

Démarrer le serveur de dev (`--webpack`, cf. incompatibilité Turbopack notée dans le ledger du chantier précédent) et ouvrir `/admin/vitrine` connecté en tant que `owner`/`staff`.

- [ ] **Step 3 : Uploader une image sur `hero.backgroundImage`**

Sélectionner le bloc « Bandeau Hero », cliquer « Choisir une image », uploader une image JPEG/PNG de test.
Expected : aperçu affiché dans le panneau, canevas WYSIWYG mis à jour avec l'image en fond du hero, « Brouillon enregistré » dans la barre du haut (autosave).

- [ ] **Step 4 : Uploader une image sur `story.image` et les 3 images `cats`**

Répéter pour le bloc « Notre histoire » (`image`) et « Vignettes catégories » (les 3 champs `foulardsImage`/`turbansImage`/`accessoiresImage`).
Expected : chaque image remplace le placeholder correspondant dans le canevas, sans erreur console.

- [ ] **Step 5 : Tester la galerie `look` (ajout, réordonnancement, retrait)**

Sélectionner le bloc « Galerie / Lookbook ». Ajouter 2 images. Vérifier que les flèches ↑/↓ inversent l'ordre. Retirer une image.
Expected : le canevas reflète l'ordre et le contenu à chaque étape ; quand la liste repasse à 0 image, les 4 vignettes de couleur placeholder réapparaissent (fallback).

- [ ] **Step 6 : Publier et vérifier la vitrine publique**

Cliquer « Publier ». Naviguer vers `/` (page publique, hors zone admin).
Expected : les images uploadées apparaissent identiquement sur la vitrine publique (hero, story, cats, look), chargées via `next/image` sans erreur 400 (remotePatterns correctement configuré).

- [ ] **Step 7 : Vérifier le rejet d'un fichier invalide**

Tenter d'uploader un fichier `.pdf` ou une image > 10 Mo sur un champ image.
Expected : message d'erreur affiché sous le champ (« Format non supporté… » / « Fichier trop volumineux… »), aucun crash, le reste de l'éditeur reste utilisable.

- [ ] **Step 8 : Confirmer l'absence de régression sur une page vierge**

Ouvrir un tenant / une page dont aucun champ image n'a encore été rempli (ou vérifier `defaultPage()` via `parsePageContent(null)`).
Expected : tous les placeholders décoratifs d'origine (rayures, labels « visuel hero · 16:9 », etc.) s'affichent exactement comme avant ce chantier.
