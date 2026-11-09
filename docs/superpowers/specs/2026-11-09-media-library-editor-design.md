# Design — Bibliothèque média dans l'éditeur de vitrine

> Suite de `2026-07-15-storefront-image-upload-design.md` (upload direct) et
> `2026-07-18-vitrine-cms-images-digitpad-design.md`. Ce chantier n'ajoute **aucun** nouveau mode de stockage :
> il ajoute un second moyen de remplir un champ image déjà existant — en réutilisant une image déjà présente
> dans le bucket Supabase, plutôt qu'en re-téléversant depuis l'appareil.

## 1. Contexte & problème

Dans `components/editor/SettingsField.tsx`, chaque champ `kind: "image"` ou `kind: "imageList"` ne propose
qu'un seul moyen de définir une image : un `<input type="file">` qui upload un nouveau fichier depuis
l'appareil (`uploadAndApply` / `uploadMultipleAndApply`, via la route `POST /api/storefront/upload-image`).

Toutes les images téléversées pour une boutique (blocs vitrine *et* photos produits) finissent dans le même
bucket Supabase `storefront-images`, sous deux familles de préfixes :

- `<tenantId>/<blockType>/<fieldKey>-<uuid>.webp` — images de blocs vitrine (route
  `app/api/storefront/upload-image/route.ts`)
- `<tenantId>/products/<uuid>.webp` — photos produits (route `app/api/inventory/upload-image/route.ts`)

Il n'existe aujourd'hui aucun moyen de parcourir ces images déjà en ligne pour en réutiliser une dans un
autre champ (ex. reprendre une photo produit dans le bloc Hero, ou réutiliser la même image "Foulards" sur
plusieurs sections). La gérante doit retélécharger depuis son téléphone/ordinateur à chaque fois, même pour
une image déjà en ligne.

**Objectif** : ajouter un bouton **"Depuis la bibliothèque"** à côté du bouton d'upload existant, ouvrant une
modale de sélection parmi les images déjà stockées pour sa boutique — **sans modifier le comportement actuel
de l'upload direct**.

## 2. Décisions de cadrage (issues du brainstorming)

- **Périmètre des images proposées** : vitrine + produits (tout le contenu du bucket sous `<tenantId>/`).
- **Champs concernés** : tous les champs `image` et `imageList`, sur tous les blocs — un seul composant
  partagé dans `SettingsField.tsx`, pas de traitement au cas par cas par bloc.
- **UI** : modale plein écran avec grille de vignettes, dans le style déjà utilisé par
  `PosVariantPickerModal.tsx` (tokens `colors`/`fonts`, `role="dialog"`, fermeture `Escape`/clic-dehors).
- **Sélection** : multiple pour les champs `imageList` (cases à cocher + validation groupée, dans la limite
  de `maxItems` du champ), simple (un clic = sélection immédiate) pour les champs `image`.
- **Pas de suppression** : la modale est strictement lecture + sélection. La suppression d'image reste gérée
  comme aujourd'hui, champ par champ (bouton "Retirer" existant dans `SettingsField.tsx`), pour éviter de
  casser silencieusement une autre section qui utiliserait la même image.
- **Aucune nouvelle table / migration Prisma** : on liste directement le contenu du bucket Supabase Storage
  au moment de l'ouverture de la modale ; pas de cache ni d'index en base pour ce premier chantier.

## 3. Architecture

### 3.1 Server Action — `listTenantImages()`

Nouvelle fonction dans `lib/storefront/actions.ts`, suivant exactement le même garde-fou que les actions
voisines (`deleteBlockImage`, etc.) :

```ts
"use server";
// ... imports existants du fichier

export type TenantImage = {
  url: string;
  path: string;        // chemin complet dans le bucket, utile pour debug/log
  folder: string;       // "products" | blockType (ex. "hero", "cats", "look"...)
  fileName: string;
  createdAt: string | null;
};

export async function listTenantImages(): Promise<
  { ok: true; images: TenantImage[] } | { ok: false; error: string }
> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Action non autorisée (droits insuffisants)." };

  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    const supabase = createAdminClient();

    // 1. Liste les sous-dossiers directs sous `<tenantId>/`
    const { data: topLevel, error: topErr } = await supabase.storage
      .from(STOREFRONT_IMAGES_BUCKET)
      .list(tenant.id, { limit: 100 });
    if (topErr) return { ok: false, error: `Erreur stockage Supabase : ${topErr.message}` };

    const folders = (topLevel ?? []).filter((entry) => entry.id === null); // dossiers = pas d'id de fichier

    // 2. Liste les fichiers de chaque sous-dossier, en parallèle
    const perFolder = await Promise.all(
      folders.map(async (folder) => {
        const { data: files } = await supabase.storage
          .from(STOREFRONT_IMAGES_BUCKET)
          .list(`${tenant.id}/${folder.name}`, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
        return (files ?? [])
          .filter((f) => f.id !== null) // exclut les sous-dossiers imprévus
          .map((f) => {
            const path = `${tenant.id}/${folder.name}/${f.name}`;
            const { data } = supabase.storage.from(STOREFRONT_IMAGES_BUCKET).getPublicUrl(path);
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
    const message = err instanceof Error ? err.message : "Erreur serveur inattendue";
    return { ok: false, error: message };
  }
}
```

Points importants :
- Utilise `createAdminClient()` (service role) exactement comme les routes d'upload — jamais de confiance
  dans un `tenantId` fourni par le client, toujours dérivé de `getCurrentTenant()` côté serveur.
- Un échec de listing d'un sous-dossier individuel ne doit pas faire planter toute la liste : `Promise.all`
  avec `data: files` potentiellement `null` → fallback `[]` (pas de `try/catch` imbriqué nécessaire car
  `.list()` ne lève pas, elle retourne `{ data, error }`).
- Limité à 100 dossiers / 200 fichiers par dossier pour ce premier chantier (largement suffisant pour une
  mono-boutique) ; pas de pagination infinie. Si ça devient limitant, un chantier séparé ajoutera une table
  d'index.

### 3.2 Composant — `MediaLibraryModal.tsx`

Nouveau fichier `components/editor/MediaLibraryModal.tsx` :

```ts
interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  multiple: boolean;
  onSelect: (urls: string[]) => void;
  remainingSlots?: number; // pour imageList : désactive la sélection au-delà de maxItems - urls.length
}
```

Comportement :
- À l'ouverture (`isOpen` passe à `true`), appelle `listTenantImages()` une fois, affiche un état
  `loading`, puis la grille groupée par `folder` (en-têtes de section : "Produits", "Hero", "Categories"...
  — libellé humain via un petit mapping `blockType → label`, avec fallback sur le `folder` brut).
- Grille de vignettes (`<img>` en `object-fit: cover`, carré, lazy-loaded) avec état `survolé`/`sélectionné`.
- Mode `multiple=false` : clic sur une vignette → `onSelect([url])` puis `onClose()` immédiat.
- Mode `multiple=true` : clic = coché/décoché (checkbox visuelle superposée), bouton bas de modale
  "Utiliser la sélection (n)" désactivé si `n === 0` ou si `n > remainingSlots`. Validation → `onSelect(urls)`
  puis `onClose()`.
- États vides/erreur : message clair ("Aucune image pour le moment — téléversez-en une d'abord." /
  "Impossible de charger la bibliothèque, réessayez.").
- Fermeture : clic sur l'overlay, bouton "×", touche `Escape` — même pattern que `PosVariantPickerModal.tsx`.
- Style : réutilise les tokens `colors`/`fonts` de `@/lib/theme/tokens`, cohérent avec le reste de
  `components/editor/`.

### 3.3 Intégration dans `SettingsField.tsx`

Deux points d'insertion, **additifs uniquement** (aucune ligne existante du chemin upload n'est retirée ou
modifiée) :

**Champ `image` simple** (bloc `if (field.kind === "image")`) : à côté du `<label>` "Choisir une
image"/"Remplacer", un second bouton `button` (même `miniBtnStyle`) "Depuis la bibliothèque" qui ouvre la
modale en `multiple={false}`. Sélection → `onChange(url)` directement (pas d'appel à `uploadAndApply`,
puisque le fichier existe déjà en storage — pas de nouvel upload, pas de suppression de l'ancienne image par
cette voie : le remplacement suit la même logique que le bouton "Remplacer" existant pour la cohérence
visuelle, mais sans upload réseau).

**Champ `imageList`** (bloc `if (field.kind === "imageList")`) : à côté du bouton d'ajout par upload
multiple, un bouton "Depuis la bibliothèque" (désactivé si `isAtMax`), ouvrant la modale en `multiple={true}`
avec `remainingSlots`. Sélection → `onChange([...urls, ...selected])`, tronqué à `max` par sécurité.

Un seul état local `mediaLibraryOpen` (et éventuellement `mediaLibraryTargetIndex` si on étend plus tard au
remplacement unitaire dans une liste) suffit par instance de `SettingsField`.

## 4. Flux de données

```
Clic "Depuis la bibliothèque"
  → setMediaLibraryOpen(true)
  → <MediaLibraryModal isOpen> monte / appelle listTenantImages() (Server Action)
  → Supabase Storage .list() × N dossiers (admin client, scopé tenant.id)
  → grille affichée
  → sélection utilisateur → onSelect(urls)
  → SettingsField: onChange(...) (même callback que le reste du champ, remonte au store d'édition existant)
  → fermeture modale
```

Aucune écriture (upload/suppression) n'a lieu dans ce flux — uniquement une lecture du storage et une mise à
jour de l'état du champ en mémoire (le brouillon est persisté par le mécanisme existant de l'éditeur, inchangé).

## 5. Gestion des erreurs

- Échec `listTenantImages` (réseau, droits, Supabase indisponible) → la modale affiche le message d'erreur
  retourné, avec un bouton "Réessayer" qui relance l'appel. Ne bloque jamais la fermeture de la modale.
- Bucket/dossier vide → état vide explicite, pas une erreur.
- Aucun impact sur le chemin d'upload existant : si la bibliothèque échoue, "Choisir une image" continue de
  fonctionner normalement (deux boutons totalement indépendants).

## 6. Tests

- **Vitest** (`lib/storefront/actions.test.ts` ou nouveau fichier) : `listTenantImages` — scoping par tenant
  (mock du client admin, vérifie que seul le préfixe `tenant.id` est listé), gestion d'un dossier vide,
  gestion d'une erreur Supabase partielle sur un sous-dossier.
- **Playwright** : dans un test existant de l'éditeur de vitrine, ouvrir un champ image → "Depuis la
  bibliothèque" → vérifier que la grille affiche au moins l'image de fixture déjà seedée → sélectionner →
  vérifier que l'aperçu du champ se met à jour sans requête d'upload réseau (interception réseau : aucun
  `POST /api/storefront/upload-image` déclenché).
- Vérification manuelle de non-régression : upload direct (device) toujours fonctionnel à l'identique sur un
  champ `image` et un champ `imageList`.

## 7. Hors périmètre (explicitement reporté)

- Suppression d'image depuis la bibliothèque.
- Recherche/filtre texte dans la modale (la grouping par section suffit tant que le volume reste faible).
- Pagination au-delà de 200 fichiers/dossier.
- Table d'index en base pour accélérer le listing (si le volume d'images grossit significativement).
