# Design — Images produit, CMS de blocs multi-instances, saisie numérique tactile

Date : 2026-07-18
Statut : validé section par section avec la propriétaire du projet.
Périmètre : trois chantiers indépendants mais cohérents, implémentables séparément dans cet ordre.

## Contexte

- L'éditeur de vitrine (`/admin/vitrine`) sait uploader des images de **blocs** (action `uploadBlockImage`, bucket Supabase `storefront-images`, compression sharp → WebP), mais les **produits** n'ont aucun champ image : le modèle Prisma `Product` n'a que `swatch`/`colors`, le formulaire « Nouveau produit » propose une palette de couleurs, et toutes les vignettes affichent un dégradé CSS.
- L'édition par blocs est figée : 9 types de blocs à exemplaire unique identifiés par leur `type`, réordonnancement par boutons ↑/↓, pas d'ajout/suppression/duplication, panneau inutilisable au doigt sur mobile (simple empilement).
- Aucune saisie numérique n'est adaptée au tactile : `<input type="number">` natifs, aucun `inputMode`, pas de pavé.

## Décisions (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Images par produit | Image principale + galerie |
| Surfaces d'affichage | Vitrine (vignettes + fiche), POS, inventaire, panier/récapitulatifs |
| Produits existants | Gestion des photos uniquement (pas d'édition complète du produit) |
| Modèle de blocs | Multi-instances : ajouter, dupliquer, supprimer ; id d'instance unique |
| UX éditeur | Liste latérale draggable (@dnd-kit) + toolbar contextuelle sur le canevas |
| Éditeur mobile | Bottom-sheet coulissant |
| Édition texte inline sur canevas | Non (v2) — formulaires du panneau, aperçu live |
| Digit pad | Pavé maison en bottom-sheet sur tactile ; saisie clavier normale sur desktop |
| Champs équipés du pad | Tous les champs numériques : prix, stock, `number` de l'éditeur, téléphones, quantités POS/panier |

## Chantier 1 — Images produit

### Modèle de données

Migration Prisma non destructive sur `Product` :

```prisma
image    String?                 // photo principale (URL publique)
gallery  String[] @default([])  // photos secondaires (fiche produit)
```

`swatch` est conservé : repli visuel quand `image` est vide (zéro régression). Le type partagé `Product` (`lib/data/types.ts`) et les mappers de `lib/data/catalog.server.ts` sont étendus.

### Upload & actions serveur

- `lib/storefront/imageUpload.ts` est **déplacé vers `lib/images/imageUpload.ts`** (il n'est plus spécifique à la vitrine) ; imports existants mis à jour. Pipeline inchangé : MIME JPEG/PNG/WebP, 10 Mo max, resize 1920 px, WebP q82.
- Nouvelle action `uploadProductImage(formData)` dans `lib/inventory/actions.ts` : garde `requireZone("dashboard")`, bucket `storefront-images`, chemin `${tenant.id}/products/${uuid}.webp` (isolation tenant par préfixe de chemin, comme les blocs).
- Nouvelle action `updateProductImages(productId, { image, gallery })` : vérifie l'appartenance au tenant (`where: { id, tenantId }`), URLs validées par Zod, `revalidatePath` des surfaces concernées.
- `productSchema` (`lib/validators/product.ts`) étendu : `image` (string, optionnel) et `gallery` (string[], optionnel).

### UI back-office

Composant réutilisable `ProductPhotosField` (même pattern que le champ image de `SettingsField` : Choisir / Remplacer / Retirer, vignettes, réordonnancement de la galerie), utilisé :

1. dans le drawer **« Nouveau produit »** : upload immédiat au choix du fichier, URLs en état de formulaire, envoyées avec `createProduct` ;
2. dans le drawer **d'édition** : nouvelle section « Photos » branchée sur `updateProductImages`. Le reste du drawer ne change pas.

### Affichage (repli dégradé partout si pas d'image)

- `ProductCard` (catalogue, home, produit vedette) : `next/image` avec l'image principale. Ajouter le host Supabase Storage à `images.remotePatterns` dans `next.config.ts`.
- Fiche produit : image principale + galerie en miniatures cliquables (maison, pas de lightbox tierce).
- POS (tuiles), tableau inventaire, lignes panier/checkout/récapitulatifs : miniature de l'image principale.

### Erreurs & limites assumées

Résultats typés `{ ok } | { ok: false; error }`, messages FR sous le champ. Les fichiers orphelins du bucket (upload puis abandon) sont acceptés en v1, comme pour les blocs.

## Chantier 2 — Blocs multi-instances

### Modèle

```ts
interface BlockInstance {
  id: string;        // nouveau — identité d'instance (uuid)
  type: BlockId;     // référence registry
  name: string;
  visible: boolean;
  settings: Record<string, unknown>;
}
```

**Compatibilité sans migration DB** : `parsePageContent` (déjà appelé à chaque lecture, brouillon et publié) génère un `id` pour tout bloc de l'ancien format. Les pages existantes fonctionnent telles quelles et sont réécrites au premier enregistrement. Le schéma Zod accepte `id` optionnel en entrée, garanti en sortie.

### Opérations (pures, dans `lib/storefront/pageContent.ts`)

- Existantes, re-signées sur `id` : `moveBlock`, `renameBlock`, `setBlockVisible`, `updateBlockSettings`.
- Nouvelles : `addBlock(page, type)` (défauts du registry, nom auto-suffixé « Bandeau Hero 2 », insertion en fin), `duplicateBlock(page, id)` (clone profond, inséré sous l'original), `removeBlock(page, id)`, `reorderBlocks(page, fromId, toId)`.

### Registry

`BLOCK_SETTINGS` gagne des métadonnées de bibliothèque par type : libellé, description courte, icône — pour le sélecteur « + Ajouter un bloc ». Tous les types sont multi-instanciables.

### Détails réglés

- **Ancres DOM** : seule la première instance d'un type porte l'ancre HTML (`#ft-story`…) — liens existants préservés, pas d'`id` DOM dupliqués.
- **Clés React & sélection** : `key={b.id}` partout ; l'état `selected` de l'éditeur devient un id d'instance.
- Actions serveur `saveDraft`/`publish`/`revertDraft` inchangées.

## Chantier 3 — Expérience éditeur

**Dépendance ajoutée (la seule)** : `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

### Desktop (colonne droite 340 px, deux zones)

1. **`BlockListPanel`** : une ligne par bloc (poignée de drag, icône, nom, badge « masqué »). Drag vertical `@dnd-kit/sortable` → `reorderBlocks`. Clic = sélection + scroll du canevas vers le bloc. Bouton « + Ajouter un bloc » en bas.
2. **`BlockSettingsPanel`** existant, sans les boutons ↑/↓ (remplacés par drag + toolbar).

### `BlockPicker`

Grille de cartes (icône, libellé, description — métadonnées du registry). Tap = insertion + sélection + scroll.

### Toolbar contextuelle canevas

Barre flottante en haut à droite du bloc sélectionné : monter / descendre / dupliquer / masquer / supprimer. Boutons ≥ 40 px. Suppression : confirmation inline (le bouton devient « Confirmer ? » pendant 3 s), pas de modale.

### Mobile & tablette (< 1024 px)

- Canevas plein écran ; barre d'outils fixe en bas : « Blocs » (sheet liste) + nom du bloc sélectionné (sheet réglages).
- Taper un bloc du canevas ouvre la sheet Réglages ; l'aperçu reste visible au-dessus, mise à jour en direct.
- Nouveau composant réutilisable **`BottomSheet`** (maison, ~100 lignes : overlay, feuille glissante, poignée, hauteur mi-écran étirable) — **partagé avec le digit pad**.

### Flux & accessibilité

Tout passe par `apply()` → autosave débouncé → `saveDraft` (Zod serveur). Autosave au drop uniquement. Brouillon/Publier/Annuler inchangés. Drag utilisable au clavier (@dnd-kit), monter/descendre en alternative, focus visibles, `aria-label` sur chaque action.

## Chantier 4 — Saisie numérique tactile

### Composants (`components/ui/`)

1. **`NumericPad`** : grille 3×4 (1-9, 0, effacer, touche contextuelle : `00` en mode montant, `+` en mode téléphone), bouton « Valider », affichage formaté de la valeur (ex. `15 000 FCFA`). Boutons ≥ 56 px, tokens du thème. Contrôlé, sans état global.
2. **`NumericField`** :

```ts
<NumericField mode="money" | "integer" | "decimal" | "phone"
  value onChange label? placeholder? min? max? />
```

### Comportement par dispositif

- **Tactile** (`useCoarsePointer()`, hook maison sur `matchMedia("(pointer: coarse)")`) : champ `readOnly` + `inputMode="none"` ; le toucher ouvre le `NumericPad` dans le `BottomSheet` partagé. Valider applique et ferme.
- **Souris/clavier** : champ normal, `inputMode` adapté (`numeric`/`decimal`/`tel`), icône pavé pour ouvrir le pad au besoin.

### Modes

`integer` (stock, quantités) · `money` (FCFA, sans décimales, formatage via `money()` de `lib/format`) · `decimal` (générique) · `phone` (`+` initial et espaces autorisés, sans bornes).

### Déploiement

| Champ | Fichier | Mode |
|---|---|---|
| Prix produit | `InventoryScreen` (création + édition) | `money` |
| Stock initial | `InventoryScreen` | `integer` |
| Champ `number` éditeur de blocs | `SettingsField` | `integer` |
| Téléphone connexion | `AccountAuthView` | `phone` |
| Téléphone fiche KYC | `CheckoutView` | `phone` |
| Quantités POS | `PosScreen` | `integer` |
| Quantités panier vitrine | `CartView` | `integer` |

Quantités POS/panier : les steppers +/− restent ; taper le chiffre central ouvre le pavé, borné par le stock (`max`).

### Validation

Le pad n'émet que des valeurs conformes au mode ; bornes appliquées à la validation avec message FR sous le champ ; la validation Zod serveur reste la source de vérité.

## Tests

- **Vitest** : opérations `pageContent` v2 (migration ancien format, add/duplicate/remove/reorder, unicité des ids, repli défauts) ; `productSchema` étendu ; logique du pad (append/delete/bornes/formatage par mode).
- **Playwright** : parcours éditeur « ajouter un bloc → renommer → réordonner → publier » ; rendu mobile de la bottom-sheet ; « créer un produit au doigt » (prix + stock via pavé) ; quantité POS via pavé.

## Hors périmètre (v2+)

Édition de texte inline sur le canevas · édition complète du produit dans le drawer d'édition (au-delà des photos) · multi-pages (À propos, FAQ…) · nettoyage des images orphelines du bucket · image par variante/couleur.

## Ordre d'implémentation recommandé

1. Chantier 1 (images produit) — indépendant, valeur immédiate.
2. Chantier 2 (modèle multi-instances) — fondation du 3.
3. Chantier 3 (UX éditeur) — dépend du 2 ; introduit `BottomSheet`.
4. Chantier 4 (digit pad) — réutilise `BottomSheet` ; peut démarrer dès que `BottomSheet` existe.
