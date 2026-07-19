# Design — Upload d'images pour l'éditeur de vitrine

> Suite du chantier `2026-07-15-storefront-block-editing-design.md` (branche `feature/storefront-foundations`,
> commits `c5c6708..6107005`), qui a livré l'édition + persistance du **contenu texte** des 9 blocs et a
> explicitement reporté tout ce qui touche aux images (`image`/`imageList`/`repeater`, cf. §12 de ce spec).

## 1. Contexte & périmètre

Le premier chantier a rendu éditable le contenu textuel scalaire de chaque bloc, avec brouillon/publié
persistés côté serveur (table `StorefrontPage`) et Server Actions gardées par `requireZone("dashboard")`.
Les champs suivants sont restés non éditables faute d'upload d'images :

- `hero.backgroundImage` — image de fond du bandeau d'accueil (le champ n'existe même pas encore dans
  `heroSchema` ; `HeroBlock.tsx` affiche un placeholder à rayures codé en dur).
- `story.image` — photo atelier (idem, `storySchema` n'a pas de champ image ; `StoryBlock.tsx` affiche un
  placeholder).
- `cats` (`CategoryTilesBlock.tsx`) — aujourd'hui 3 catégories (Foulards, Turbans, Accessoires) dérivées en
  dur du catalogue (`storefrontCategories`), avec une couleur de fond codée en dur (`TILE_COLOR`) et un lien
  auto-généré (`/catalogue?cat=X`). Aucune structure d'items éditable.
- `look` (`LookbookBlock.tsx`) — 4 vignettes de couleur codées en dur (`LOOKS`), aucune image en base.

**Objectif de ce chantier** : permettre à la gérante d'uploader/remplacer les images de ces 4 champs depuis
l'éditeur `/admin/vitrine`, stockées sur Supabase Storage, sans jamais avoir à écrire de code.

**Décisions de cadrage** (issues du brainstorming) :
- `cats` reste sur son architecture actuelle (3 catégories fixes) — on ajoute une image par catégorie, **pas**
  de repeater complet (`label`/`image`/`lien` éditables individuellement). Le lien reste auto-généré.
- `look` est inclus dans ce chantier : on introduit un nouveau `FieldKind: "imageList"` pour rendre la
  galerie éditable (ajout/retrait/réordonnancement), plutôt que de le reporter à un chantier séparé.

## 2. Infrastructure Supabase Storage & sécurité

### 2.1 Bucket

- Un bucket **partagé** unique : `storefront-images`, public en lecture.
- Chemin de fichier : `<tenantId>/<blockType>/<uuid>.webp` (ex. `clx123abc/hero/f3a1c9e0.webp`).
- Choix motivé par la cohérence avec le reste du schéma (mono-table + colonne `tenantId`, pas de ressource
  par-boutique) et la préparation au multi-boutique futur sans réécriture.

### 2.2 RLS sur `storage.objects`

Réutilise **sans les recréer** les helpers SECURITY DEFINER déjà en place (migration
`20260713120100_rls`) : `public.current_tenant_id()` et `public.current_role()`.

Nouvelle migration SQL (appliquée via le MCP Supabase, pas `prisma migrate deploy` — cf.
`.superpowers/sdd/progress.md`, section « Plan 3 », pour le contexte de cette découverte d'infra) :

```sql
insert into storage.buckets (id, name, public)
values ('storefront-images', 'storefront-images', true)
on conflict (id) do nothing;

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

- Lecture publique sur tout le bucket : les images sont décoratives, non sensibles, et doivent être
  servies au public via la vitrine sans authentification.
- Écriture (insert/update/delete) réservée à `owner`/`staff` du tenant correspondant au premier segment
  du chemin — même garde que les autres tables métier (`Product`, `Customer`, etc.).
- Aucune nouvelle table Prisma : un bucket + policies Storage n'est pas un modèle applicatif. La garde-fou
  CLAUDE.md « nouvelle table → migration + policy + test » est honorée via cette migration + les tests de
  la section 5, sans introduire de table fictive.

### 2.3 Upload — jamais côté client, jamais `service_role`

Toute écriture passe par une **Server Action**, jamais par un appel `supabase-js` direct depuis le
navigateur. Le Server Action utilise `createClient()` de `lib/supabase/server.ts` (client authentifié par
cookies de session), pas la clé `service_role` : la RLS s'applique avec le rôle/tenant réels de
l'utilisateur connecté, cohérent avec le pattern déjà en place pour `saveDraft`/`publish`/`revertDraft`.

## 3. Modèle de données & registry

### 3.1 Nouveaux `FieldKind`

```ts
export type FieldKind =
  | "text" | "textarea" | "select" | "toggle" | "number" | "url"
  | "image" | "imageList";
```

- `image` → valeur `z.string()` : URL publique complète de l'image, ou `""` si aucune image (fallback sur
  le placeholder décoratif existant — zéro régression visuelle, même logique que `cats.title` vide
  aujourd'hui).
- `imageList` → valeur `z.array(z.string())` : liste ordonnée d'URLs publiques, ordre = ordre d'affichage.

### 3.2 Champs ajoutés par bloc (`lib/storefront/blockSettings.ts`)

| Bloc | Champ(s) ajouté(s) | Type | Défaut |
|---|---|---|---|
| `hero` | `backgroundImage` | `image` | `""` |
| `story` | `image` | `image` | `""` |
| `cats` | `foulardsImage`, `turbansImage`, `accessoiresImage` | `image` × 3 | `""` |
| `look` | `images` | `imageList` | `[]` |

Chaque schéma Zod (`heroSchema`, `storySchema`, `catsSchema`, `lookSchema`) gagne les champs
correspondants ; `heroDefaults`/`storyDefaults`/`catsDefaults`/`lookDefaults` sont initialisés vides ; les
`FieldDescriptor[]` associés référencent les nouveaux champs.

### 3.3 Composants de rendu

`HeroBlock`, `StoryBlock`, `CategoryTilesBlock`, `LookbookBlock` sont mis à jour : si le champ image
correspondant est non vide, afficher l'image via `next/image` (remplace le placeholder rayé) ; sinon
conserver le placeholder actuel à l'identique. Pour `look`, si `settings.images` est vide, garder les 4
vignettes de couleur codées en dur en fallback (zéro régression si la gérante n'a encore rien uploadé).

`parsePageContent` (`lib/storefront/pageContent.ts`) n'a besoin d'aucune modification : la validation par
schéma Zod par type de bloc est déjà générique.

## 4. Flux d'upload

### 4.1 Server Action `uploadBlockImage`

Ajoutée à `lib/storefront/actions.ts` :

1. `requireZone("dashboard")` — sinon `{ ok: false, error }`, même garde que les autres actions.
2. Reçoit un `FormData` : fichier + `blockType` + `fieldKey` (utilisé pour construire le chemin de
   destination, ex. `hero/backgroundImage`).
3. **Validation d'entrée** (fonction pure `validateImageUpload`, extraite pour être testable
   indépendamment) : type MIME dans `image/jpeg | image/png | image/webp`, taille brute ≤ 10 Mo. Message
   d'erreur explicite sinon (« Format non supporté » / « Fichier trop volumineux (max 10 Mo) »).
4. **Compression serveur** via `sharp` (nouvelle dépendance — standard sur Next.js/Node, nécessite le
   runtime Node, pas Edge ; les Server Actions sont Node par défaut, aucun changement de config) :
   redimensionnement à une largeur max de 1920px (ratio conservé, pas d'agrandissement si l'image source
   est plus petite), conversion en WebP qualité ~82.
5. Upload du résultat vers `storefront-images/<tenantId>/<blockType>/<uuid>.webp` via le client Supabase
   serveur.
6. Retour `{ ok: true, url }` (URL publique complète) ou `{ ok: false, error }`.

### 4.2 Référence stockée

L'URL publique complète est stockée telle quelle dans le JSON `settings` du bloc — cohérent avec le champ
`url` existant (ex. `ctaLink`). Dette acceptée : si l'URL de base du bucket change un jour, une migration
de données serait nécessaire (même nature de dette que les autres champs du chantier précédent).

### 4.3 Cycle brouillon/publié — fichiers orphelins

Remplacer une image (nouvel upload sur le même champ) ou faire « Annuler » laisse l'ancien fichier en
Storage sans qu'il soit plus référencé nulle part. **Dette acceptée en v1**, cohérente avec l'absence
d'historique de versions déjà actée pour le texte. Le volume (quelques champs, une seule boutique) reste
négligeable. Un nettoyage périodique (job comparant Storage ↔ JSON référencé) pourra être ajouté plus tard
si le volume le justifie.

## 5. UI éditeur

### 5.1 `SettingsField.tsx` — variant `image`

- Aperçu miniature de la valeur actuelle, ou zone pointillée si vide.
- Bouton « Choisir une image » (ou « Remplacer » si une image existe déjà) → `<input type="file"
  accept="image/jpeg,image/png,image/webp">` caché, déclenché au clic.
- À la sélection : appel direct de la Server Action `uploadBlockImage` (état local `uploading` désactive
  les boutons, affiche un indicateur texte simple) ; à la résolution, `onChange(url)` — repasse par le
  circuit d'autosave existant (`onChangeSetting` → debounce → `saveDraft`), aucun nouveau mécanisme de
  sauvegarde.
- Erreur d'upload affichée inline sous le champ, même style que les erreurs de publier/annuler déjà en
  place (commit `6ea4178`).
- Bouton « Retirer » : remet la valeur à `""` (ne supprime pas le fichier Storage — cf. §4.3).

### 5.2 `SettingsField.tsx` — variant `imageList`

- Grille des miniatures existantes ; chacune avec un bouton « Retirer » et deux flèches ↑/↓ pour
  réordonner — même pattern que le réordonnancement des blocs dans `BlockSettingsPanel` (pas de
  `@dnd-kit`, cohérent avec son report déjà acté dans le chantier précédent).
- Bouton « Ajouter une image » en fin de grille, déclenchant le même flux d'upload que le variant `image`,
  puis ajout de l'URL en fin de tableau.

## 6. Tests (Vitest, cohérent avec `blockSettings.test.ts` existant)

- Le test générique existant (« les valeurs par défaut de chaque bloc parsent leur schéma », « chaque
  descripteur de champ pointe vers une clé du schéma ») couvre automatiquement les nouveaux champs sans
  modification.
- `validateImageUpload` : cas testés indépendamment — format accepté/rejeté, taille sous/au-dessus de la
  limite — isolé de l'appel réseau Supabase pour rester testable sans mock lourd.
- `uploadBlockImage` : test avec `requireZone` mocké, vérifie le rejet hors zone `dashboard` — même
  approche que `lib/auth/index.test.ts`.
- Pas de test Playwright : le repo n'en a pas encore configuré ; on reste sur Vitest, cohérent avec
  l'existant.

## 7. Hors périmètre (reporté ou dette acceptée)

- Nettoyage des fichiers orphelins en Storage (§4.3).
- Repeater complet pour `cats` (items `label`/`image`/`lien` éditables individuellement, ajout/suppression
  de catégories) — reste sur 3 catégories fixes avec une image chacune.
- Légendes par image dans le lookbook.
- Drag-and-drop (`@dnd-kit`) pour réordonner les images — flèches ↑/↓ seulement.
- Recadrage/crop manuel par la gérante — la compression (redimensionnement + conversion WebP) est
  automatique côté serveur, sans contrôle utilisateur sur le cadrage.
- Richtext (Tiptap), `productRef`/`collectionRef`, palette d'ajout/suppression de blocs — toujours hors
  périmètre, reportés depuis le chantier précédent.
