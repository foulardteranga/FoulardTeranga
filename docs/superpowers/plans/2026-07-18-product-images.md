# Product Images Implementation Plan (Chantier 1/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux produits une photo principale + une galerie, uploadées depuis le back-office et affichées sur toutes les surfaces (vitrine, POS, inventaire, panier/checkout), avec repli sur le dégradé `swatch` existant.

**Architecture:** Deux colonnes ajoutées au modèle Prisma `Product` (`image`, `gallery`). Le pipeline d'upload existant des blocs (`validateImageUpload` + `compressImage` + bucket Supabase `storefront-images`) est déplacé vers `lib/images/` et réutilisé par deux nouvelles Server Actions (`uploadProductImage`, `updateProductImages`). Un composant `ProductPhotosField` gère l'UI d'upload dans les deux drawers de l'inventaire. Les surfaces d'affichage lisent `product.image` avec repli `stripe(swatch)`.

**Tech Stack:** Next.js 16.2 App Router, Prisma 7, Supabase Storage, sharp, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-vitrine-cms-images-digitpad-design.md` (§ Chantier 1)

## Global Constraints

- Langue produit : FR. Code, commits, identifiants : EN. Conventional Commits.
- TypeScript strict, jamais de `any` (préférer `unknown` + narrowing).
- Server Actions : garde `requireZone("dashboard")`, résultats typés `{ ok: true } | { ok: false; error: string }`, messages d'erreur en FR, pas d'exception silencieuse.
- Isolation tenant : toute requête Prisma filtre par `tenantId` ; tout chemin Storage est préfixé `${tenant.id}/`.
- Bucket Storage : `storefront-images` (existant — ne pas en créer d'autre). Le host Supabase est déjà dans `images.remotePatterns` de `next.config.ts` (rien à faire).
- Aucune nouvelle dépendance.
- Repli visuel : chaque surface affichant une image garde le dégradé `stripe(swatch)`/`swatch` quand `image` est vide — zéro régression pour les produits sans photo.
- Vérification par tâche : `npm run typecheck` et `npm test` doivent passer avant chaque commit.

---

### Task 1: Schéma Prisma, type `Product`, mapper `toProduct`

**Files:**
- Modify: `prisma/schema.prisma:90-113` (model Product)
- Modify: `lib/data/types.ts:3-26` (interface Product)
- Modify: `lib/data/catalog.server.ts:7-24` (toProduct)
- Test: `lib/data/catalog.test.ts:59-72` (describe "toProduct")

**Interfaces:**
- Consumes: —
- Produces: `Product.image?: string` et `Product.gallery: string[]` (type applicatif) ; colonnes Prisma `image String?`, `gallery String[] @default([])`. Toutes les tâches suivantes s'appuient dessus.

- [ ] **Step 1: Write the failing test**

Dans `lib/data/catalog.test.ts`, remplacer le `describe("toProduct", …)` existant par :

```ts
describe("toProduct", () => {
  it("maps a Prisma row (category) to the app Product shape (cat)", () => {
    const row = {
      id: "p1", tenantId: "foulard-teranga", category: "Foulards" as const, name: "Foulard Wax Abidjan",
      variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "swatch", colors: ["#26326B"], motif: "Wax",
      lengths: ["90 × 90 cm"], description: "desc", oldPrice: null, badge: "Nouveau", featured: false,
      image: null, gallery: [],
      createdAt: new Date(), updatedAt: new Date(),
    };
    const product = toProduct(row);
    expect(product.cat).toBe("Foulards");
    expect(product.oldPrice).toBeUndefined();
    expect(product.badge).toBe("Nouveau");
    expect(product.image).toBeUndefined();
    expect(product.gallery).toEqual([]);
  });

  it("maps image and gallery when present", () => {
    const row = {
      id: "p2", tenantId: "foulard-teranga", category: "Foulards" as const, name: "Foulard soie",
      variant: "Soie · 70×70", price: 22000, stock: 6, swatch: "swatch", colors: ["#26326B"], motif: "Kente",
      lengths: ["70 × 70 cm"], description: "desc", oldPrice: null, badge: null, featured: false,
      image: "https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/a.webp",
      gallery: ["https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/b.webp"],
      createdAt: new Date(), updatedAt: new Date(),
    };
    const product = toProduct(row);
    expect(product.image).toBe(row.image);
    expect(product.gallery).toEqual(row.gallery);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/data/catalog.test.ts`
Expected: FAIL — TypeScript/assertion : `image` n'existe ni sur la row Prisma ni sur `Product`.

- [ ] **Step 3: Add the Prisma columns**

Dans `prisma/schema.prisma`, model `Product`, après la ligne `featured    Boolean         @default(false)` :

```prisma
  image       String?
  gallery     String[]        @default([])
```

- [ ] **Step 4: Create and apply the migration**

Run: `npx prisma migrate dev --name product_images`
Expected: `Your database is now in sync with your schema.` — la migration créée ne contient que deux `ALTER TABLE "Product" ADD COLUMN` (non destructif). Le client Prisma est régénéré automatiquement.

- [ ] **Step 5: Extend the app type and the mapper**

Dans `lib/data/types.ts`, interface `Product`, après la ligne `swatch: string;` :

```ts
  /** Photo principale (URL publique Supabase Storage) ; absente = repli sur le dégradé `swatch`. */
  image?: string;
  /** Photos secondaires affichées dans la galerie de la fiche produit. */
  gallery: string[];
```

Dans `lib/data/catalog.server.ts`, fonction `toProduct`, après `swatch: row.swatch,` :

```ts
    image: row.image ?? undefined,
    gallery: row.gallery,
```

- [ ] **Step 6: Fix the test fixtures**

`lib/data/catalog.test.ts` : `FIXTURE_PRODUCTS` doit compiler avec le champ requis `gallery`. Ajouter `gallery: []` à chacun des 12 produits de la fixture (même style inline que les autres champs).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- lib/data/catalog.test.ts` puis `npm run typecheck`
Expected: PASS les deux. Si `typecheck` révèle d'autres constructeurs de `Product` (fixtures, mocks), leur ajouter `gallery: []`.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/data/types.ts lib/data/catalog.server.ts lib/data/catalog.test.ts
git commit -m "feat(products): add image and gallery columns to Product"
```

---

### Task 2: Déplacer le pipeline d'upload vers `lib/images/`

**Files:**
- Move: `lib/storefront/imageUpload.ts` → `lib/images/imageUpload.ts`
- Move: `lib/storefront/imageUpload.test.ts` → `lib/images/imageUpload.test.ts`
- Modify: `lib/storefront/actions.ts:11` (import)

**Interfaces:**
- Consumes: —
- Produces: `lib/images/imageUpload.ts` exportant `STOREFRONT_IMAGES_BUCKET: string`, `MAX_UPLOAD_BYTES: number`, `validateImageUpload(file: { type: string; size: number }): { ok: true } | { ok: false; error: string }`, `compressImage(input: Buffer): Promise<Buffer>`. Les tâches 3+ importent depuis `@/lib/images/imageUpload`.

- [ ] **Step 1: Move both files with git**

```bash
mkdir -p lib/images
git mv lib/storefront/imageUpload.ts lib/images/imageUpload.ts
git mv lib/storefront/imageUpload.test.ts lib/images/imageUpload.test.ts
```

(Le test importe `./imageUpload` en relatif : il reste valide après le déplacement conjoint.)

- [ ] **Step 2: Update the single external import**

Dans `lib/storefront/actions.ts`, remplacer :

```ts
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "./imageUpload";
```

par :

```ts
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "@/lib/images/imageUpload";
```

- [ ] **Step 3: Verify nothing else references the old path**

Run: `grep -rn "storefront/imageUpload" --include="*.ts" --include="*.tsx" app components lib`
Expected: aucune sortie.

- [ ] **Step 4: Run tests**

Run: `npm test -- lib/images/imageUpload.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A lib/images lib/storefront
git commit -m "refactor(images): move upload pipeline to lib/images (shared beyond storefront)"
```

---

### Task 3: Validator étendu + Server Actions `uploadProductImage` / `updateProductImages`

**Files:**
- Modify: `lib/validators/product.ts`
- Create: `lib/validators/product.test.ts`
- Modify: `lib/inventory/actions.ts`

**Interfaces:**
- Consumes: `validateImageUpload`, `compressImage`, `STOREFRONT_IMAGES_BUCKET` (Task 2) ; colonnes Prisma `image`/`gallery` (Task 1).
- Produces:
  - `productSchema` accepte `image?: string (url)` et `gallery: string[] (urls, défaut [])`.
  - `productImagesSchema` : `{ image: string(url) | null; gallery: string[](urls) }` exporté de `lib/validators/product.ts`.
  - `uploadProductImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }>` — champ `file` requis.
  - `updateProductImages(productId: string, images: unknown): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing validator tests**

Créer `lib/validators/product.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { productSchema, productImagesSchema } from "./product";

const BASE = {
  category: "Foulards",
  name: "Foulard tissé main",
  variant: "Coton · Bleu nuit",
  motif: "Wax",
  price: 15000,
  stock: 10,
  swatch: "#26326B",
  lengths: "Taille unique",
  description: "",
};

const URL_A = "https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/a.webp";
const URL_B = "https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/b.webp";

describe("productSchema — images", () => {
  it("accepte un produit sans image ni galerie (défauts)", () => {
    const parsed = productSchema.parse(BASE);
    expect(parsed.image).toBeUndefined();
    expect(parsed.gallery).toEqual([]);
  });

  it("accepte une image principale et une galerie en URLs", () => {
    const parsed = productSchema.parse({ ...BASE, image: URL_A, gallery: [URL_B] });
    expect(parsed.image).toBe(URL_A);
    expect(parsed.gallery).toEqual([URL_B]);
  });

  it("rejette une image qui n'est pas une URL", () => {
    expect(productSchema.safeParse({ ...BASE, image: "pas-une-url" }).success).toBe(false);
  });

  it("rejette une galerie contenant autre chose que des URLs", () => {
    expect(productSchema.safeParse({ ...BASE, gallery: ["nope"] }).success).toBe(false);
  });
});

describe("productImagesSchema", () => {
  it("accepte image null (retrait de la photo principale)", () => {
    const parsed = productImagesSchema.parse({ image: null, gallery: [] });
    expect(parsed.image).toBeNull();
    expect(parsed.gallery).toEqual([]);
  });

  it("accepte image + galerie en URLs", () => {
    expect(productImagesSchema.parse({ image: URL_A, gallery: [URL_B] })).toEqual({
      image: URL_A,
      gallery: [URL_B],
    });
  });

  it("rejette un objet incomplet", () => {
    expect(productImagesSchema.safeParse({ image: URL_A }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/validators/product.test.ts`
Expected: FAIL — `productImagesSchema` n'existe pas ; `parsed.image`/`parsed.gallery` inconnus.

- [ ] **Step 3: Extend the validators**

Dans `lib/validators/product.ts`, ajouter dans `productSchema` (après `swatch`) :

```ts
  image: z.url().optional(),
  gallery: z.array(z.url()).default([]),
```

Et en fin de fichier :

```ts
/** Mise à jour des photos d'un produit existant (drawer d'édition, section Photos). */
export const productImagesSchema = z.object({
  image: z.url().nullable(),
  gallery: z.array(z.url()),
});
export type ProductImagesInput = z.infer<typeof productImagesSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/validators/product.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire images into `createProduct` and add the two actions**

Dans `lib/inventory/actions.ts` :

1. Compléter les imports :

```ts
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "@/lib/images/imageUpload";
import { productSchema, productImagesSchema, type ProductInput } from "@/lib/validators/product";
```

2. Dans `createProduct`, ajouter au `data:` de `prisma.product.create` (après `description:`) :

```ts
      image: parsed.data.image ?? null,
      gallery: parsed.data.gallery,
```

3. Ajouter à la fin du fichier :

```ts
/** Upload une photo produit vers Supabase Storage, compressée côté serveur. */
export async function uploadProductImage(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Requête invalide." };

  const validation = validateImageUpload(file);
  if (!validation.ok) return validation;

  try {
    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(raw);
    const tenant = await getCurrentTenant();
    const path = `${tenant.id}/products/${randomUUID()}.webp`;

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

/** Remplace les photos (principale + galerie) d'un produit du tenant courant. */
export async function updateProductImages(
  productId: string,
  images: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = productImagesSchema.safeParse(images);
  if (!parsed.success) return { ok: false, error: "Photos invalides." };

  try {
    const tenant = await getCurrentTenant();
    const { count } = await prisma.product.updateMany({
      where: { id: productId, tenantId: tenant.id },
      data: { image: parsed.data.image, gallery: parsed.data.gallery },
    });
    if (count === 0) return { ok: false, error: "Produit introuvable." };

    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/pos");
    revalidatePath("/");
    revalidatePath("/catalogue");
    revalidatePath(`/produit/${productId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 6: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS. (Les deux actions touchent Prisma/Supabase : pas de test unitaire — la logique testable, validation et compression, l'est déjà via Tasks 2-3.)

- [ ] **Step 7: Commit**

```bash
git add lib/validators/product.ts lib/validators/product.test.ts lib/inventory/actions.ts
git commit -m "feat(products): image validators and upload/update server actions"
```

---

### Task 4: `ProductPhotosField` + photos dans le drawer « Nouveau produit »

**Files:**
- Create: `components/dashboard/ProductPhotosField.tsx`
- Modify: `components/dashboard/screens/InventoryScreen.tsx:277-430` (NewProductForm + NewProductDrawer)

**Interfaces:**
- Consumes: `uploadProductImage` (Task 3).
- Produces: `<ProductPhotosField image={string} gallery={string[]} onChange={(next: { image: string; gallery: string[] }) => void} />` — composant contrôlé (`image === ""` = pas de photo principale). Réutilisé tel quel par la Task 5.

- [ ] **Step 1: Create the component**

Créer `components/dashboard/ProductPhotosField.tsx` (même pattern visuel que le champ image de `components/editor/SettingsField.tsx`) :

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { uploadProductImage } from "@/lib/inventory/actions";

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

export function ProductPhotosField({
  image,
  gallery,
  onChange,
}: {
  /** URL de la photo principale ; "" = aucune. */
  image: string;
  gallery: string[];
  onChange: (next: { image: string; gallery: string[] }) => void;
}) {
  const [uploading, setUploading] = useState<"image" | "gallery" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, target: "image" | "gallery") {
    setUploading(target);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadProductImage(formData);
    setUploading(null);
    if (!res.ok) { setError(res.error); return; }
    if (target === "image") onChange({ image: res.url, gallery });
    else onChange({ image, gallery: [...gallery, res.url] });
  }

  function filePicker(target: "image" | "gallery", label: string) {
    return (
      <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
        {uploading === target ? "Envoi…" : label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading !== null}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f, target);
          }}
          style={{ display: "none" }}
        />
      </label>
    );
  }

  return (
    <div>
      <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
        Photo principale
      </label>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Photo principale du produit" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 9, marginBottom: 8 }} />
      ) : (
        <div style={{ width: "100%", height: 90, border: `1.5px dashed ${colors.borderField}`, borderRadius: 9, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: colors.muted }}>
          Aucune photo
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {filePicker("image", image ? "Remplacer" : "Choisir une photo")}
        {image && (
          <button type="button" onClick={() => onChange({ image: "", gallery })} disabled={uploading !== null} style={miniBtnStyle}>
            Retirer
          </button>
        )}
      </div>

      <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
        Galerie (fiche produit)
      </label>
      {gallery.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {gallery.map((src, i) => (
            <div key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1} de la galerie`} style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 9 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <button type="button" onClick={() => onChange({ image, gallery: moveItem(gallery, i, i - 1) })} disabled={i === 0} style={tinyBtnStyle}>↑</button>
                <button type="button" onClick={() => onChange({ image, gallery: moveItem(gallery, i, i + 1) })} disabled={i === gallery.length - 1} style={tinyBtnStyle}>↓</button>
                <button type="button" onClick={() => onChange({ image, gallery: gallery.filter((_, j) => j !== i) })} style={tinyBtnStyle}>Retirer</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {filePicker("gallery", "Ajouter une photo")}
      {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Add photos to the creation form**

Dans `components/dashboard/screens/InventoryScreen.tsx` :

1. Importer le composant :

```ts
import { ProductPhotosField } from "@/components/dashboard/ProductPhotosField";
```

2. Étendre `NewProductForm` et `EMPTY_PRODUCT_FORM` (versions complètes) :

```ts
interface NewProductForm {
  category: (typeof PRODUCT_CATEGORIES)[number];
  name: string;
  variant: string;
  motif: string;
  price: string;
  stock: string;
  swatch: string;
  lengths: string;
  description: string;
  image: string;
  gallery: string[];
}

const EMPTY_PRODUCT_FORM: NewProductForm = {
  category: "Foulards",
  name: "",
  variant: "",
  motif: "",
  price: "",
  stock: "",
  swatch: SWATCH_PALETTE[0],
  lengths: "",
  description: "",
  image: "",
  gallery: [],
};
```

3. Dans `NewProductDrawer`, adapter `submit()` pour transmettre les photos (`image` vide → non envoyée) :

```ts
    const result = await createProduct({
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      image: form.image || undefined,
      gallery: form.gallery,
    });
```

4. Dans le corps scrollable du drawer, juste après le `<FormField label="Nom du produit">…</FormField>` :

```tsx
          <FormField label="Photos">
            <ProductPhotosField
              image={form.image}
              gallery={form.gallery}
              onChange={({ image, gallery }) => setForm((s) => ({ ...s, image, gallery }))}
            />
          </FormField>
```

- [ ] **Step 3: Typecheck and test run**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Lancer le dev server (`npm run dev`, port 3002 si configuré ainsi), ouvrir `/admin/inventaire` → « + Produit » : choisir une photo principale (aperçu affiché), ajouter 2 photos de galerie, réordonner, retirer une, créer le produit. Vérifier l'absence d'erreur console et la création en base (le produit apparaît dans le tableau).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ProductPhotosField.tsx components/dashboard/screens/InventoryScreen.tsx
git commit -m "feat(inventory): product photos upload in the creation drawer"
```

---

### Task 5: Section « Photos » du drawer d'édition (produits existants)

**Files:**
- Modify: `components/dashboard/screens/InventoryScreen.tsx:450-568` (EditDrawer)

**Interfaces:**
- Consumes: `ProductPhotosField` (Task 4), `updateProductImages` (Task 3), `Product.image`/`gallery` (Task 1).
- Produces: —

- [ ] **Step 1: Add photo state and save handler to EditDrawer**

Dans `EditDrawer` (`InventoryScreen.tsx`), ajouter les imports en tête de fichier :

```ts
import { updateProductImages } from "@/lib/inventory/actions";
```

Puis dans le composant `EditDrawer`, avant le `return` :

```tsx
  const router = useRouter();
  const showToast = useBackoffice((s) => s.showToast);
  const [photos, setPhotos] = useState({ image: p.image ?? "", gallery: p.gallery });
  const [savingPhotos, setSavingPhotos] = useState(false);
  const photosDirty = photos.image !== (p.image ?? "") || photos.gallery.join("|") !== p.gallery.join("|");

  async function savePhotos() {
    setSavingPhotos(true);
    const res = await updateProductImages(p.id, {
      image: photos.image || null,
      gallery: photos.gallery,
    });
    setSavingPhotos(false);
    if (!res.ok) { showToast(res.error, "error"); return; }
    showToast("Photos enregistrées", "success");
    router.refresh();
  }
```

- [ ] **Step 2: Render the Photos section**

Dans le corps scrollable du drawer (`<div style={{ flex: 1, overflowY: "auto", … }}>`), au-dessus de `<div style={sectionLabel}>Stock par emplacement</div>` :

```tsx
          <div style={sectionLabel}>Photos</div>
          <div style={{ marginBottom: 22 }}>
            <ProductPhotosField image={photos.image} gallery={photos.gallery} onChange={setPhotos} />
            {photosDirty && (
              <button
                onClick={savePhotos}
                disabled={savingPhotos}
                className="ft-primary-btn"
                style={{ marginTop: 10, height: 40, padding: "0 16px", border: "none", borderRadius: 9, background: colors.primary, color: "#fff", font: `600 13px ${fonts.ui}`, cursor: savingPhotos ? "default" : "pointer", opacity: savingPhotos ? 0.7 : 1 }}
              >
                {savingPhotos ? "Enregistrement…" : "Enregistrer les photos"}
              </button>
            )}
          </div>
```

- [ ] **Step 3: Show the thumbnail in the drawer header and the table**

1. En-tête du drawer — remplacer `<span style={{ width: 44, height: 44, borderRadius: 10, flex: "none", background: p.swatch }} />` par :

```tsx
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, flex: "none", objectFit: "cover" }} />
          ) : (
            <span style={{ width: 44, height: 44, borderRadius: 10, flex: "none", background: p.swatch }} />
          )}
```

2. Tableau inventaire — dans la colonne Produit, remplacer `<span style={{ width: 34, height: 34, borderRadius: 8, flex: "none", background: p.swatch }} />` par :

```tsx
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt="" style={{ width: 34, height: 34, borderRadius: 8, flex: "none", objectFit: "cover" }} />
                        ) : (
                          <span style={{ width: 34, height: 34, borderRadius: 8, flex: "none", background: p.swatch }} />
                        )}
```

- [ ] **Step 4: Typecheck, tests, manual verification**

Run: `npm run typecheck && npm test`
Expected: PASS.
Manuel : `/admin/inventaire` → cliquer un produit existant → section Photos : ajouter une principale + une galerie → « Enregistrer les photos » → toast succès, miniature visible dans le tableau après refresh.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/screens/InventoryScreen.tsx
git commit -m "feat(inventory): photos section in the edit drawer and table thumbnails"
```

---

### Task 6: Affichage vitrine — `ProductCard` et fiche produit

**Files:**
- Modify: `components/storefront/ProductCard.tsx:21-42`
- Modify: `components/storefront/views/ProductView.tsx:59-75`

**Interfaces:**
- Consumes: `Product.image`/`gallery` (Task 1).
- Produces: —

- [ ] **Step 1: ProductCard renders the main image**

Dans `components/storefront/ProductCard.tsx` :

1. Ajouter l'import :

```ts
import Image from "next/image";
```

2. Dans le `<Link>` vignette (celui avec `aspectRatio: "4 / 5"`), garder `background: stripe(product.colors[0])` (repli visible pendant le chargement et pour les produits sans photo) et insérer comme premier enfant :

```tsx
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{ objectFit: "cover" }}
          />
        )}
```

- [ ] **Step 2: Product page renders main image + gallery**

Dans `components/storefront/views/ProductView.tsx` :

1. Ajouter l'import :

```ts
import Image from "next/image";
```

2. Ajouter l'état et la liste des photos au début du composant (après `const [fav, setFav] = useState(false);`) :

```ts
  const photos = [product.image, ...product.gallery].filter((u): u is string => Boolean(u));
  const [photoIdx, setPhotoIdx] = useState(0);
```

3. Remplacer le bloc image principal (le `<div>` avec `aspectRatio: "4 / 5"` contenant `photo produit 4:5`) : garder le conteneur et le bouton favoris tels quels, mais remplacer le `<span>photo produit 4:5</span>` par :

```tsx
            {photos.length > 0 ? (
              <Image
                src={photos[Math.min(photoIdx, photos.length - 1)]}
                alt={product.name}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
                priority
              />
            ) : (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#9a8f7d" }}>photo produit 4:5</span>
            )}
```

(Le conteneur a déjà `position: relative` + `overflow: hidden` — requis par `fill`.)

4. Remplacer la grille de 4 miniatures couleur (le `<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", … }}>` sous l'image) par : miniatures **photos** quand il y en a, sinon comportement actuel :

```tsx
          {photos.length > 1 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {photos.slice(0, 4).map((src, i) => (
                <button
                  key={src}
                  onClick={() => setPhotoIdx(i)}
                  aria-label={`Photo ${i + 1}`}
                  style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", padding: 0, cursor: "pointer", border: i === photoIdx ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)", background: "none" }}
                >
                  <Image src={src} alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                </button>
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {product.colors.slice(0, 4).map((hex, i) => (
                <div key={hex} style={{ aspectRatio: "1", borderRadius: 10, background: stripe(hex), border: i === colorIdx ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)" }} />
              ))}
            </div>
          ) : null}
```

- [ ] **Step 3: Typecheck, tests, manual verification**

Run: `npm run typecheck && npm test`
Expected: PASS.
Manuel : `/catalogue` — le produit avec photo affiche sa photo, les autres leur dégradé ; `/produit/<id>` — photo principale + miniatures cliquables ; un produit sans photo garde exactement le rendu d'avant.

- [ ] **Step 4: Commit**

```bash
git add components/storefront/ProductCard.tsx components/storefront/views/ProductView.tsx
git commit -m "feat(storefront): product photos on cards and product page gallery"
```

---

### Task 7: POS, panier vitrine et checkout

**Files:**
- Modify: `components/dashboard/screens/PosScreen.tsx:215-259` (tuile ProductCard locale)
- Modify: `lib/store/cartLogic.ts:1-9` (StoreCartLine)
- Modify: `lib/store/useBackoffice.ts:4-12` (CartLine) + action `addToCart`
- Modify: `components/storefront/blocks/ProductGridBlock.tsx:41`, `components/storefront/blocks/FeaturedProductBlock.tsx`, `components/storefront/views/CatalogView.tsx`, `components/storefront/views/ProductView.tsx:39-45` (appels `addToCart`)
- Modify: `components/storefront/views/CartView.tsx:59`, `components/storefront/views/CheckoutView.tsx:151` (miniatures)

**Interfaces:**
- Consumes: `Product.image` (Task 1).
- Produces: `StoreCartLine.image?: string` et `CartLine.image?: string` — champ optionnel, les paniers persistés existants restent valides.

- [ ] **Step 1: POS tile shows the photo**

Dans la fonction locale `ProductCard` de `PosScreen.tsx`, dans le `<div>` vignette (`aspectRatio: "1 / 1"`, `background: p.swatch`), insérer comme premier enfant (avant le `<span>` référence) :

```tsx
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
```

(Le conteneur a déjà `position: relative`. Le badge « Stock » reste au-dessus car positionné après dans le DOM.)

- [ ] **Step 2: Cart lines carry the image (storefront + POS)**

1. `lib/store/cartLogic.ts` — ajouter à `StoreCartLine` :

```ts
  /** Photo principale du produit au moment de l'ajout (miniatures panier/checkout). */
  image?: string;
```

2. `lib/store/useBackoffice.ts` — ajouter à `CartLine` (après `variant: string;`) :

```ts
  image?: string;
```

et dans l'action `addToCart` du store, remplacer la ligne qui pousse la nouvelle ligne :

```ts
        cart.push({ id: p.id, name: p.name, variant: p.variant, price: p.price, qty: 1, discount: 0 });
```

par :

```ts
        cart.push({ id: p.id, name: p.name, variant: p.variant, price: p.price, qty: 1, discount: 0, image: p.image });
```

3. Mettre à jour les 4 appels `addToCart({ … })` de la vitrine pour passer `image` :
   - `ProductGridBlock.tsx:41` : `addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price, image: p.image });`
   - `FeaturedProductBlock.tsx:54` : `addToCart({ productId: product.id, name: product.name, variant: product.lengths[0], colorHex: product.colors[0], price: product.price, image: product.image });`
   - `CatalogView.tsx:205` : `addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price, image: p.image });`
   - `ProductView.tsx` (les deux appels, dans `doAdd` et `buyNow`) : `addToCart({ productId: product.id, name: product.name, variant, colorHex: product.colors[colorIdx], price: product.price, qty, image: product.image });`

- [ ] **Step 3: Cart and checkout thumbnails**

1. `CartView.tsx` — remplacer `<div style={{ width: 74, height: 90, flex: "none", borderRadius: 10, background: stripe(line.colorHex) }} />` par :

```tsx
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.image} alt="" style={{ width: 74, height: 90, flex: "none", borderRadius: 10, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 74, height: 90, flex: "none", borderRadius: 10, background: stripe(line.colorHex) }} />
                  )}
```

2. `CheckoutView.tsx` — remplacer `<div style={{ width: 44, height: 54, flex: "none", borderRadius: 8, background: stripe(line.colorHex) }} />` par :

```tsx
                {line.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.image} alt="" style={{ width: 44, height: 54, flex: "none", borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 44, height: 54, flex: "none", borderRadius: 8, background: stripe(line.colorHex) }} />
                )}
```

- [ ] **Step 4: Typecheck, tests, manual verification**

Run: `npm run typecheck && npm test`
Expected: PASS (les tests `cartLogic` existants restent verts — champ optionnel).
Manuel : `/admin/pos` — tuiles avec photo ; vitrine — ajouter au panier un produit avec photo → miniature dans `/panier` et `/commander` ; un produit sans photo garde le dégradé.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/screens/PosScreen.tsx lib/store/cartLogic.ts lib/store/useBackoffice.ts components/storefront/blocks/ProductGridBlock.tsx components/storefront/blocks/FeaturedProductBlock.tsx components/storefront/views/CatalogView.tsx components/storefront/views/ProductView.tsx components/storefront/views/CartView.tsx components/storefront/views/CheckoutView.tsx
git commit -m "feat: product photo thumbnails on POS tiles, cart and checkout"
```

---

### Task 8: Vérification de bout en bout

**Files:** aucun nouveau — vérification globale.

**Interfaces:** —

- [ ] **Step 1: Full local gate**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: tout PASS, build sans erreur.

- [ ] **Step 2: End-to-end manual pass**

Parcours complet sur le dev server :
1. `/admin/inventaire` → créer un produit **avec** principale + 2 photos de galerie.
2. Vérifier ses photos sur : tableau inventaire, `/admin/pos`, `/` (bloc Nouveautés), `/catalogue`, `/produit/<id>` (galerie cliquable), `/panier`, `/commander`.
3. Éditer un produit existant **sans** photo → tout affiche encore le dégradé (zéro régression) ; lui ajouter une photo → elle apparaît partout après refresh.
4. Uploader un PDF et un fichier > 10 Mo → messages d'erreur FR, pas de crash.

- [ ] **Step 3: Final commit (if any fixups)**

```bash
git add -A
git commit -m "fix(products): end-to-end fixups for product images"
```

(Seulement s'il y a eu des correctifs ; sinon rien à committer.)
