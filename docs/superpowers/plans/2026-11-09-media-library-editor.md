# Bibliothèque média — éditeur de vitrine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton "Depuis la bibliothèque" à côté de l'upload existant sur tous les champs image/imageList de l'éditeur de vitrine, permettant de réutiliser une image déjà en ligne (bloc vitrine ou produit) sans re-téléverser, sans toucher au chemin d'upload actuel.

**Architecture:** Un Server Action `listTenantImages()` (scopé tenant, mêmes garde-fous que le reste de `lib/storefront/actions.ts`) liste le contenu du bucket Supabase `storefront-images` sous `<tenantId>/`. Une nouvelle modale cliente `MediaLibraryModal.tsx` affiche ces images en grille groupée par section et retourne la sélection via un callback. `SettingsField.tsx` l'intègre de façon strictement additive sur les deux branches `image` et `imageList`.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), React 19.2 "use client", TypeScript strict, Supabase JS v2 (`@supabase/supabase-js` Storage API, vérifiée via Context7 — `list(path, { limit, sortBy })`, entrées dossier = `id: null`), Vitest.

## Global Constraints

- TypeScript strict, pas de `any`.
- Aucune nouvelle migration Prisma, aucune nouvelle table : lecture directe du Storage.
- Ne jamais faire confiance à un `tenantId` côté client — toujours dérivé de `getCurrentTenant()` côté serveur (règle CLAUDE.md §9).
- Le chemin d'upload direct existant (`uploadAndApply`, `uploadMultipleAndApply`, `replaceImageAtIndex`) ne doit subir **aucune** modification de ligne — uniquement des ajouts.
- Pas de suppression d'image possible depuis la nouvelle modale (décision de cadrage de la spec, §2).
- Styles en objets inline avec les tokens `colors`/`fonts` de `@/lib/theme/tokens` (convention du dossier `components/editor/` et `components/pos/`), pas de Tailwind/shadcn ici.
- Textes d'interface en français.

---

### Task 1: Server Action `listTenantImages()`

**Files:**
- Modify: `lib/storefront/actions.ts` (ajout en fin de fichier, après `deleteBlockImage`, ligne 198)
- Test: `lib/storefront/actions.test.ts`

**Interfaces:**
- Produces: `export type TenantImage = { url: string; path: string; folder: string; fileName: string; createdAt: string | null }` et `export async function listTenantImages(): Promise<{ ok: true; images: TenantImage[] } | { ok: false; error: string }>`, tous deux exportés depuis `lib/storefront/actions.ts`. Consommés par `MediaLibraryModal.tsx` (Task 2).

- [ ] **Step 1: Écrire le test qui échoue**

Dans `lib/storefront/actions.test.ts`, mettre à jour l'import et ajouter le bloc `describe` (le fichier mocke déjà `requireZone` pour retourner `{ allowed: false }`, donc ce test vérifie le rejet par garde-fou — même pattern que `uploadBlockImage`/`deleteBlockImage` juste au-dessus) :

```ts
import { uploadBlockImage, deleteBlockImage, listTenantImages } from "./actions";
```

```ts
describe("listTenantImages", () => {
  it("rejette hors zone dashboard", async () => {
    const res = await listTenantImages();
    expect(res).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test -- lib/storefront/actions.test.ts`
Expected: FAIL — `listTenantImages is not a function` (ou erreur TypeScript d'import manquant).

- [ ] **Step 3: Implémenter `listTenantImages`**

Ajouter à la fin de `lib/storefront/actions.ts` (après la fonction `deleteBlockImage`, qui se termine ligne 198) :

```ts
export type TenantImage = {
  url: string;
  path: string;
  folder: string;
  fileName: string;
  createdAt: string | null;
};

/**
 * Liste les images déjà en storage pour le tenant courant (blocs vitrine + photos
 * produits), groupées par sous-dossier. Lecture seule — ne modifie jamais le storage.
 */
export async function listTenantImages(): Promise<
  { ok: true; images: TenantImage[] } | { ok: false; error: string }
> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    const admin = createAdminClient();

    const { data: topLevel, error: topErr } = await admin.storage
      .from(STOREFRONT_IMAGES_BUCKET)
      .list(tenant.id, { limit: 100 });
    if (topErr) {
      console.error("[listTenantImages] Échec du listing racine:", topErr);
      return { ok: false, error: "Une erreur est survenue, réessayez." };
    }

    // Supabase Storage : une entrée "dossier" a id === null, une entrée "fichier" a id !== null.
    const folders = (topLevel ?? []).filter((entry) => entry.id === null);

    const perFolder = await Promise.all(
      folders.map(async (folder) => {
        const { data: files, error: filesErr } = await admin.storage
          .from(STOREFRONT_IMAGES_BUCKET)
          .list(`${tenant.id}/${folder.name}`, {
            limit: 200,
            sortBy: { column: "created_at", order: "desc" },
          });
        if (filesErr) {
          console.error(`[listTenantImages] Échec du listing de ${folder.name}:`, filesErr);
          return [] as TenantImage[];
        }
        return (files ?? [])
          .filter((f) => f.id !== null)
          .map((f) => {
            const path = `${tenant.id}/${folder.name}/${f.name}`;
            const { data } = admin.storage.from(STOREFRONT_IMAGES_BUCKET).getPublicUrl(path);
            return {
              url: data.publicUrl,
              path,
              folder: folder.name,
              fileName: f.name,
              createdAt: f.created_at ?? null,
            } satisfies TenantImage;
          });
      })
    );

    const images = perFolder.flat().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { ok: true, images };
  } catch (err) {
    console.error("[listTenantImages] Exception:", err);
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npm test -- lib/storefront/actions.test.ts`
Expected: PASS (3 tests : `uploadBlockImage`, `deleteBlockImage`, `listTenantImages`).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add lib/storefront/actions.ts lib/storefront/actions.test.ts
git commit -m "$(cat <<'EOF'
feat(storefront): add listTenantImages server action

Liste les images déjà en storage (vitrine + produits) pour le tenant
courant, scopées et groupées par dossier, en lecture seule.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Composant `MediaLibraryModal.tsx`

**Files:**
- Create: `components/editor/MediaLibraryModal.tsx`

**Interfaces:**
- Consumes: `listTenantImages()` et `TenantImage` depuis `@/lib/storefront/actions` (Task 1) ; `DEFAULT_BLOCK_NAMES` depuis `@/lib/storefront/blockIds` ; `colors`, `fonts`, `adminBorder` depuis `@/lib/theme/tokens` ; `Icon`, `ICONS` depuis `@/components/ui/Icon`.
- Produces: `export function MediaLibraryModal(props: MediaLibraryModalProps)` avec
  `MediaLibraryModalProps = { isOpen: boolean; onClose: () => void; multiple: boolean; onSelect: (urls: string[]) => void; remainingSlots?: number }`, exporté depuis `components/editor/MediaLibraryModal.tsx`. Consommé par `SettingsField.tsx` (Tasks 3 et 4).

Ce composant n'a pas de dépendance au store `useBackoffice` ni au flux d'upload — il est strictement lecture + sélection, donc aucun test Vitest de logique métier n'est nécessaire ici (c'est de l'UI pure, vérifiée visuellement au Task 5). Pas d'étape TDD pour ce composant ; on l'écrit directement puis on le vérifie dans le navigateur au Task 5.

- [ ] **Step 1: Créer le composant**

Créer `components/editor/MediaLibraryModal.tsx` :

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { DEFAULT_BLOCK_NAMES } from "@/lib/storefront/blockIds";
import { listTenantImages, type TenantImage } from "@/lib/storefront/actions";

const FOLDER_LABELS: Record<string, string> = {
  products: "Produits",
  ...DEFAULT_BLOCK_NAMES,
};

function folderLabel(folder: string): string {
  return FOLDER_LABELS[folder] ?? folder;
}

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sélection multiple (champs imageList) ou simple (champs image). */
  multiple: boolean;
  onSelect: (urls: string[]) => void;
  /** Nombre maximum d'images sélectionnables en mode multiple. */
  remainingSlots?: number;
}

export function MediaLibraryModal({
  isOpen,
  onClose,
  multiple,
  onSelect,
  remainingSlots,
}: MediaLibraryModalProps) {
  const [images, setImages] = useState<TenantImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  function load() {
    setError(null);
    setLoading(true);
    listTenantImages()
      .then((res) => {
        if (res.ok) setImages(res.images);
        else setError(res.error);
      })
      .catch(() => setError("Impossible de charger la bibliothèque, réessayez."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, TenantImage[]>();
    for (const img of images) {
      const list = map.get(img.folder) ?? [];
      list.push(img);
      map.set(img.folder, list);
    }
    return Array.from(map.entries());
  }, [images]);

  if (!isOpen) return null;

  const max = multiple ? (remainingSlots ?? Infinity) : 1;

  function toggle(url: string) {
    if (!multiple) {
      onSelect([url]);
      onClose();
      return;
    }
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= max) return prev;
      return [...prev, url];
    });
  }

  function confirmSelection() {
    if (selected.length === 0) return;
    onSelect(selected);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-library-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(30, 27, 24, 0.52)",
        backdropFilter: "blur(2px)",
        animation: "ft-fade 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 20px 48px -6px rgba(30,27,24,0.24)",
          border: adminBorder,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "ft-fade 0.18s ease-out",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${colors.borderSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: colors.ivory,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="media-library-title"
              style={{ margin: 0, fontFamily: fonts.display, fontWeight: 600, fontSize: 17, color: colors.ink }}
            >
              Bibliothèque d'images
            </h3>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {multiple
                ? `Sélectionnez une ou plusieurs images déjà en ligne${max < Infinity ? ` (${max} max)` : ""}.`
                : "Choisissez une image déjà en ligne."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: "none",
              background: "#EBE5D8",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.muted,
              flex: "none",
            }}
          >
            <Icon path={ICONS.close} size={15} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: colors.muted, fontSize: 13 }}>
              Chargement des images…
            </div>
          ) : error ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ color: colors.fgDanger, fontSize: 13, marginBottom: 10 }}>{error}</div>
              <button
                type="button"
                onClick={load}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${colors.borderField}`,
                  background: "#fff",
                  color: colors.primary,
                  font: `600 12px ${fonts.ui}`,
                  cursor: "pointer",
                }}
              >
                Réessayer
              </button>
            </div>
          ) : images.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: colors.muted, fontSize: 13 }}>
              Aucune image pour le moment — téléversez-en une d'abord.
            </div>
          ) : (
            grouped.map(([folder, items]) => (
              <div key={folder} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: colors.muted,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    marginBottom: 8,
                  }}
                >
                  {folderLabel(folder)} ({items.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                  {items.map((img) => {
                    const isSelected = selected.includes(img.url);
                    const disabled = multiple && !isSelected && selected.length >= max;
                    return (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => toggle(img.url)}
                        disabled={disabled}
                        title={img.fileName}
                        style={{
                          position: "relative",
                          aspectRatio: "1 / 1",
                          borderRadius: 10,
                          overflow: "hidden",
                          border: isSelected ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.borderField}`,
                          padding: 0,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.4 : 1,
                          background: "#f0ede8",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        {isSelected && (
                          <span
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: colors.primary,
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon path={ICONS.check} size={12} stroke="#fff" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {multiple && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: `1px solid ${colors.borderSoft}`,
              background: "#FAF7F2",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                border: `1.5px solid ${colors.borderField}`,
                background: "#fff",
                color: colors.ink,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmSelection}
              disabled={selected.length === 0}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: selected.length === 0 ? colors.disabled : colors.primary,
                color: "#fff",
                font: `600 13px ${fonts.ui}`,
                cursor: selected.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Utiliser la sélection ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: aucune erreur (le composant n'est encore importé nulle part, donc pas d'erreur de câblage possible à ce stade — seulement des erreurs internes au fichier).

- [ ] **Step 3: Revue design/ergonomie avec le skill /impeccable**

Invoquer le skill `impeccable` sur `components/editor/MediaLibraryModal.tsx` pour une passe de critique visuelle et d'ergonomie (hiérarchie visuelle de la grille, lisibilité des en-têtes de section, affordance de la sélection/coche, états vide/erreur/chargement, cohérence avec le reste de `components/editor/`). Appliquer directement dans le fichier les corrections pertinentes que le skill remonte (sans changer les props/l'interface du composant, qui sont fixées par ce plan). Relancer `npm run typecheck` après application.

- [ ] **Step 4: Commit**

```bash
git add components/editor/MediaLibraryModal.tsx
git commit -m "$(cat <<'EOF'
feat(editor): add MediaLibraryModal component

Modale de sélection d'images déjà en storage (vitrine + produits),
groupées par section, sélection simple ou multiple. Pas encore
câblée dans l'éditeur (Tasks suivantes).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Câblage dans `SettingsField.tsx` — champ `image`

**Files:**
- Modify: `components/editor/SettingsField.tsx`

**Interfaces:**
- Consumes: `MediaLibraryModal` depuis `@/components/editor/MediaLibraryModal` (Task 2).

- [ ] **Step 1: Ajouter l'import et l'état local**

Dans `components/editor/SettingsField.tsx`, ligne 10 (après l'import de `prepareImageForUpload`/`uploadBlockImageClient`), ajouter :

```ts
import { MediaLibraryModal } from "@/components/editor/MediaLibraryModal";
```

Puis, juste après la ligne `const [error, setError] = useState<string | null>(null);` (ligne ~60, dans le corps de `SettingsField`, avant tout `if`), ajouter :

```ts
  const [libraryOpen, setLibraryOpen] = useState(false);
```

- [ ] **Step 2: Ajouter le bouton et la modale dans la branche `image`**

Dans le bloc `if (field.kind === "image") { ... }`, remplacer exactement :

```tsx
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
            {uploading ? "Envoi en cours…" : url ? "Remplacer" : "Choisir une image"}
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
            <button type="button" onClick={handleRemoveSingle} disabled={uploading} style={miniBtnStyle}>
              Retirer
            </button>
          )}
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
      </div>
    );
  }
```

par :

```tsx
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
            {uploading ? "Envoi en cours…" : url ? "Remplacer" : "Choisir une image"}
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
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            disabled={uploading}
            style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}
          >
            Depuis la bibliothèque
          </button>
          {url && (
            <button type="button" onClick={handleRemoveSingle} disabled={uploading} style={miniBtnStyle}>
              Retirer
            </button>
          )}
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
        <MediaLibraryModal
          isOpen={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          multiple={false}
          onSelect={([picked]) => {
            if (picked) onChange(picked);
          }}
        />
      </div>
    );
  }
```

(Seul ajout : le bouton "Depuis la bibliothèque" et le rendu de `<MediaLibraryModal>`. Rien d'autre ne change dans ce bloc — `uploadAndApply`, `handleRemoveSingle`, l'`<input type="file">` restent identiques.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 4: Vérification manuelle non-régression (upload direct)**

Lancer le serveur de dev (`npm run dev` ou l'équivalent `.claude/launch.json` → config `dev`), ouvrir `/personnalisation` (éditeur de vitrine), sélectionner un bloc ayant un champ image simple (ex. Hero → "Image de fond"), vérifier que :
- "Choisir une image" / "Remplacer" fonctionne toujours exactement comme avant (upload réel depuis l'appareil).
- Le nouveau bouton "Depuis la bibliothèque" apparaît à côté, ouvre la modale, et qu'une sélection met bien à jour l'aperçu de l'image sans déclencher de requête `POST /api/storefront/upload-image` (vérifiable dans l'onglet réseau du navigateur).

- [ ] **Step 5: Commit**

```bash
git add components/editor/SettingsField.tsx
git commit -m "$(cat <<'EOF'
feat(editor): wire media library picker into single image fields

Ajoute le bouton "Depuis la bibliothèque" sur les champs image
simples, sans modifier le chemin d'upload direct existant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Câblage dans `SettingsField.tsx` — champ `imageList`

**Files:**
- Modify: `components/editor/SettingsField.tsx`

**Interfaces:**
- Consumes: même `MediaLibraryModal` (Task 2), variables locales déjà définies dans la branche `imageList` : `urls: string[]`, `max: number`, `isAtMax: boolean`, `remainingSlots: number` (ligne 330-333).

- [ ] **Step 1: Ajouter le bouton et la modale dans la branche `imageList`**

Dans le bloc `if (field.kind === "imageList") { ... }`, remplacer exactement :

```tsx
        <label
          style={{
            ...miniBtnStyle,
            cursor: uploading || isAtMax ? "default" : "pointer",
            opacity: isAtMax ? 0.5 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
          }}
        >
          {uploading
            ? "Téléversement en cours…"
            : isAtMax
            ? `Limite atteinte (${max} images)`
            : urls.length === 0
            ? "Ajouter des images (5 min - 10 max)"
            : `+ Ajouter d'autres images (${remainingSlots} restante${remainingSlots > 1 ? "s" : ""})`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading || isAtMax}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (files.length > 0) {
                const allowedFiles = files.slice(0, remainingSlots);
                uploadMultipleAndApply(allowedFiles, (addedUrls) => {
                  onChange([...urls, ...addedUrls].slice(0, max));
                });
              }
            }}
            style={{ display: "none" }}
          />
        </label>
        {error && (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#B3261E",
              background: "#FDF2F2",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #FCA5A5",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }
```

par :

```tsx
        <label
          style={{
            ...miniBtnStyle,
            cursor: uploading || isAtMax ? "default" : "pointer",
            opacity: isAtMax ? 0.5 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
          }}
        >
          {uploading
            ? "Téléversement en cours…"
            : isAtMax
            ? `Limite atteinte (${max} images)`
            : urls.length === 0
            ? "Ajouter des images (5 min - 10 max)"
            : `+ Ajouter d'autres images (${remainingSlots} restante${remainingSlots > 1 ? "s" : ""})`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading || isAtMax}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (files.length > 0) {
                const allowedFiles = files.slice(0, remainingSlots);
                uploadMultipleAndApply(allowedFiles, (addedUrls) => {
                  onChange([...urls, ...addedUrls].slice(0, max));
                });
              }
            }}
            style={{ display: "none" }}
          />
        </label>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={uploading || isAtMax}
          style={{
            ...miniBtnStyle,
            cursor: uploading || isAtMax ? "default" : "pointer",
            opacity: isAtMax ? 0.5 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            marginTop: 8,
          }}
        >
          {isAtMax ? `Limite atteinte (${max} images)` : "Depuis la bibliothèque"}
        </button>
        {error && (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#B3261E",
              background: "#FDF2F2",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #FCA5A5",
            }}
          >
            {error}
          </div>
        )}
        <MediaLibraryModal
          isOpen={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          multiple
          remainingSlots={remainingSlots}
          onSelect={(picked) => onChange([...urls, ...picked].slice(0, max))}
        />
      </div>
    );
  }
```

(Seul ajout : le bouton "Depuis la bibliothèque" et `<MediaLibraryModal>`. L'`<input type="file" multiple>` et `uploadMultipleAndApply` restent identiques.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle non-régression (upload multiple)**

Sur un bloc à galerie (ex. "look"/Lookbook, champ "Galerie"), vérifier que :
- L'ajout multiple par upload fonctionne toujours à l'identique.
- Le bouton "Depuis la bibliothèque" ouvre la modale en mode sélection multiple, respecte `remainingSlots` (désactive les vignettes au-delà de la limite), et qu'une validation ajoute bien les images choisies à la liste existante (sans dépasser `maxItems`).
- Le bouton est désactivé avec le message "Limite atteinte" quand `isAtMax` est vrai, comme le bouton d'upload existant.

- [ ] **Step 4: Commit**

```bash
git add components/editor/SettingsField.tsx
git commit -m "$(cat <<'EOF'
feat(editor): wire media library picker into image list fields

Ajoute le bouton "Depuis la bibliothèque" sur les champs imageList
(sélection multiple, respect de remainingSlots/maxItems), sans
modifier le chemin d'upload multiple existant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Vérification finale globale

**Files:** aucun (vérification uniquement).

- [ ] **Step 1: Suite de tests complète**

Run: `npm test`
Expected: tous les tests passent, y compris les 3 tests de `lib/storefront/actions.test.ts`.

- [ ] **Step 2: Typecheck complet**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: aucune erreur (notamment sur les deux `// eslint-disable-next-line @next/next/no-img-element` déjà utilisés dans `MediaLibraryModal.tsx`, cohérents avec le reste du fichier `SettingsField.tsx`).

- [ ] **Step 4: Vérification visuelle dans le navigateur**

Démarrer le serveur de dev (config `dev` de `.claude/launch.json`), ouvrir `/personnalisation`, et pour chaque famille de champ :
1. Champ `image` simple (ex. Hero → "Image de fond") : bouton "Depuis la bibliothèque" visible à côté de "Choisir une image"/"Remplacer", modale s'ouvre, grille groupée par section ("Produits", "Hero", "Categories"...), sélection applique l'image et ferme la modale.
2. Champ `imageList` (ex. Lookbook → "Galerie") : bouton "Depuis la bibliothèque" sous le bouton d'ajout, sélection multiple avec compteur, validation ajoute les images sans dépasser la limite.
3. Cas vide : sur une boutique sans aucune image encore en ligne, le message "Aucune image pour le moment" s'affiche (peut être vérifié sur un tenant de test vide, ou en lisant le code si aucun tenant vide n'est disponible).
4. Fermeture : clic sur l'overlay, bouton "×", touche `Echap` — tous fonctionnels.

- [ ] **Step 5: Confirmer la non-régression du bucket/chemins existants**

Vérifier dans les DevTools réseau qu'une sélection depuis la bibliothèque ne déclenche **aucun** appel à `POST /api/storefront/upload-image` ni `POST /api/inventory/upload-image` — uniquement l'appel Server Action `listTenantImages` à l'ouverture de la modale.
