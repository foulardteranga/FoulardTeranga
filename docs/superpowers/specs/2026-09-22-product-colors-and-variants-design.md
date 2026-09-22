# Spec — Gestion avancée des couleurs et variantes de produits

> Date : 2026-09-22 · Portée : permettre à la gérante et au personnel autorisé d'associer des variantes de couleur avec suivi de stock unitaire à chaque produit, recherche intelligente par alias avec génération locale de nuances, sélection de couleur libre et persistance des favoris, sélection rapide au POS et sur la vitrine, tout en préservant l'intégrité historique inaltérable des commandes.

---

## 1. Contexte & Objectifs

Actuellement, les produits (`Product`) ne disposent que d'une liste plate de codes hexadécimaux décoratifs (`colors: String[]`) et d'un stock unique global (`stock: Int`). Un même foulard (ex. *Foulard Satin Élégance*) ne peut pas distinguer son stock entre différentes teintes (*Bordeaux : 8 unités, Bleu nuit : 5 unités, Beige : 12 unités*).

Cette spécification formalise :
1. La transformation de la couleur en **variante d'inventaire de premier ordre** (`ProductVariant`).
2. Un **moteur local de couleurs et de nuances** (hors-ligne, +120 teintes répertoriées avec synonymes et calcul mathématique HSL de nuances voisines claires/sombres/saturées).
3. Un sélecteur ergonomique avec **recherche prédictive, couleurs récentes, favorites de la boutique et choix personnalisé libre**.
4. L'adaptation de l'écran de caisse **POS** avec un tiroir de sélection de variante instantané.
5. La modernisation de la **fiche produit vitrine** avec affichage épuré des pastilles (5 premières + badge `+X`), accessibilité non-visuelle obligatoire, mise à jour dynamique de la photo et blocage en cas de rupture de la couleur.
6. La préservation stricte de l'historique d'achat des clientes et des mouvements d'inventaire.

---

## 2. Décisions d'architecture validées

| Sujet | Décision validée |
|---|---|
| **Axe de variante** | **Couleur uniquement** : chaque ligne de variante correspond à une couleur avec son stock unitaire. Les dimensions (`lengths`) restent un attribut descriptif sans sous-stock combinatoire. |
| **Stockage des couleurs** | **Approche hybride** : dictionnaire de référence riche embarqué en local/mémoire (+120 teintes) + table PostgreSQL `TenantCustomColor` pour les teintes personnalisées et favorites de la boutique. |
| **Génération des nuances** | **Calcul algorithmique HSL local** (0ms de latence, zéro dépendance API externe) produisant 5 pastilles : référence, plus claire, plus sombre, plus saturée, adoucie/poudrée. |
| **Sélection en caisse (POS)** | **Tiroir / Pop-in rapide** au clic sur un produit multi-couleurs, affichant les pastilles, le libellé et le stock disponible (variantes épuisées grisées). |
| **Déduction de stock** | **Atomique par variante** : la vente en caisse ou la validation de commande en ligne décrémente `ProductVariant.stock`. `Product.stock` est maintenu comme la somme des variantes actives. |
| **Fiche produit vitrine** | Pastilles discrètes (5 premières + bouton « +X autres »), nom textuel de la couleur visible, bascule sur la photo dédiée si renseignée, désactivation du panier si stock = 0. |
| **Immuabilité historique** | `OrderLine` enregistre une copie figée (`variantName`, `colorHex`, `variantId` avec `onDelete: SetNull`). Même si une couleur est renommée, désactivée ou supprimée plus tard, la commande passée reste intacte. |

---

## 3. Schéma de Données (`prisma/schema.prisma`)

### 3.1 Nouvelle table `ProductVariant`
```prisma
model ProductVariant {
  id         String   @id @default(cuid())
  productId  String
  colorName  String   // ex. "Bordeaux", "Bleu nuit", "Terracotta"
  colorHex   String   // ex. "#6B1D2F"
  stock      Int      @default(0)
  sku        String?
  image      String?  // Photo dédiée optionnelle (URL Supabase Storage)
  active     Boolean  @default(true)
  position   Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  product        Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderLines     OrderLine[]
  stockMovements StockMovement[]

  @@index([productId])
  @@index([active])
}
```

### 3.2 Nouvelle table `TenantCustomColor`
```prisma
model TenantCustomColor {
  id         String   @id @default(cuid())
  tenantId   String
  name       String   // ex. "Terracotta clair"
  hex        String   // ex. "#D4704B"
  family     String?  // ex. "Terres & Ocres"
  isFavorite Boolean  @default(false)
  createdAt  DateTime @default(now())

  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

### 3.3 Évolutions des modèles existants

- **`Product`** :
  - Relation `variants: ProductVariant[]`.
  - Le champ `stock: Int` est conservé pour la rapidité des listes du catalogue, mis à jour comme la somme des stocks des variantes actives.
  - Le champ `colors: String[]` reste synchronisé avec la liste des HEX des variantes actives.

- **`OrderLine`** :
  - `variantId: String?` avec `@relation(fields: [variantId], references: [id], onDelete: SetNull)`
  - `variantName: String?` (copie figée au moment de l'achat)
  - `colorHex: String?` (copie figée)

- **`StockMovement`** :
  - `variantId: String?` avec `@relation(fields: [variantId], references: [id], onDelete: SetNull)` (traçabilité du mouvement par variante).

---

## 4. Moteur de Couleurs & Nuances

### 4.1 Bibliothèque locale (`lib/colors/catalog.ts`)
Catalogue typé contenant plus de 120 teintes orientées textile et accessoires avec alias :
```ts
export interface ColorEntry {
  name: string;
  hex: string;
  family: string;
  aliases: string[];
}
```
Exemples d'entrées :
- `{ name: "Bordeaux", hex: "#6B1D2F", family: "Rouges & Vins", aliases: ["Burgundy", "Rouge bordeaux", "Lie-de-vin", "Wine"] }`
- `{ name: "Bleu nuit", hex: "#1A244D", family: "Bleus & Indigos", aliases: ["Midnight blue", "Marine foncé", "Bleu sombre"] }`
- `{ name: "Terracotta", hex: "#C86442", family: "Terres & Ocres", aliases: ["Terre cuite", "Brique", "Rouille"] }`
- `{ name: "Vert olive", hex: "#636B46", family: "Verts & Végétaux", aliases: ["Olive", "Kaki clair", "Vert militaire"] }`
- `{ name: "Beige sable", hex: "#D8C4A9", family: "Neutres & Sables", aliases: ["Sable", "Beige clair", "Dune"] }`
- `{ name: "Rose poudré", hex: "#DDA7A5", family: "Roses & Pastels", aliases: ["Powder pink", "Rose pâle", "Vieux rose"] }`
- `{ name: "Camel", hex: "#B87842", family: "Bruns & Fauves", aliases: ["Chameau", "Caramel", "Fauve"] }`

Fonction de recherche `searchColors(query: string, customColors: TenantCustomColor[]): ColorEntry[]` :
Recherche normalisée sans accent, vérifiant le nom, la famille et les alias.

### 4.2 Algorithme de calcul des nuances (`lib/colors/shades.ts`)
Fonction `generateShades(baseHex: string, baseName: string): ShadeOption[]` :
1. Conversion HEX → HSL (`h, s, l`).
2. Calcul des variations :
   - *Plus claire* : `l = Math.min(0.92, l + 0.12)`, `s = Math.max(0.2, s - 0.04)`
   - *Plus sombre* : `l = Math.max(0.12, l - 0.12)`, `s = Math.min(1.0, s + 0.04)`
   - *Plus vive / éclatante* : `s = Math.min(1.0, s + 0.20)`
   - *Poudrée / adoucie* : `s = Math.max(0.15, s - 0.25)`, `l = Math.min(0.88, l + 0.06)`
   - *Référence* : HEX d'origine
3. Reconversion HSL → HEX et attribution d'un libellé clair pour chaque pastille.

---

## 5. Expérience Utilisateur & Interfaces

### 5.1 Back-office — Éditeur de Variantes ([InventoryScreen.tsx](file:///Users/willmac/Documents/Anti%20Gravity/Mes%20Projets%20Vibe%20cod/Foulards-Teranga-main/components/dashboard/screens/InventoryScreen.tsx))
- **Composant `ProductVariantsField`** :
  - En-tête avec compteur : *« Variantes de couleur & stock (X variantes · Total: Y unités) »*.
  - Barre de recherche avec autocomplétion : la saisie de « Bordeaux » affiche immédiatement les 5 pastilles de nuances générées.
  - Clic sur une pastille : ajoute la variante dans la liste.
  - Ligne de variante :
    - Pastille ronde de couleur + aperçu HEX.
    - Champ texte pour le nom commercial (pré-rempli, éditable).
    - Champ numérique `stock` avec validation.
    - Sélecteur de photo dédiée (sélection depuis la galerie du produit ou upload direct).
    - Switch `Actif / Inactif`.
    - Bouton supprimer (icône corbeille).
  - Raccourcis rapides : pastilles des **Couleurs récentes** et **Couleurs favorites**.
  - Bouton « Choisir une couleur personnalisée » : ouvre un pop-in avec sélecteur libre, saisie HEX, nom et case « Mettre en favori boutique ».

### 5.2 Caisse POS ([PosScreen.tsx](file:///Users/willmac/Documents/Anti%20Gravity/Mes%20Projets%20Vibe%20cod/Foulards-Teranga-main/components/dashboard/screens/PosScreen.tsx))
- **Composant `PosVariantPickerModal`** :
  - Si le produit cliqué possède plusieurs variantes actives : un modal compact s'ouvre.
  - Titre du produit + prix.
  - Grille de pastilles de couleurs avec libellé et stock :
    - Variante en stock : pastille vive, stock affiché (ex. *« 8 dispo »*), tapable.
    - Variante épuisée : pastille barrée/grisée, libellé *« Épuisé »*, désactivée.
  - Un tap ajoute l'article au panier de vente avec sa variante.
- **Ticket de caisse** : mentionne explicitement le nom de la couleur sélectionnée sous le libellé de l'article.

### 5.3 Vitrine Client ([ProductView.tsx](file:///Users/willmac/Documents/Anti%20Gravity/Mes%20Projets%20Vibe%20cod/Foulards-Teranga-main/components/storefront/views/ProductView.tsx))
- **Affichage des pastilles** :
  - Rendu des 5 premières couleurs actives.
  - Si > 5 couleurs, bouton `+X teintes` ouvrant le panneau complet.
  - Pastille active avec double bordure contrastée.
  - Libellé accessible au-dessus des pastilles : `Couleur — <Nom>` (ex. *Couleur — Terracotta*).
- **Interactivité** :
  - Si la variante possède une photo dédiée, mise à jour immédiate du visuel produit principal.
  - Si le stock de la variante sélectionnée est égal à 0 : badge rouge *« Épuisé pour cette couleur »* et désactivation des boutons « Ajouter au panier » et « Commander ».

### 5.4 Panier & Demande de Commande
- Lignes clées par `(productId, variantId)`.
- Récapitulatif avec miniature, nom du foulard et nom de la couleur.
- `submitWebOrder` persiste les informations figées de la variante.
- `confirmOrder` dans le back-office vérifie le stock de la variante et décrémente `ProductVariant.stock` avec création d'un `StockMovement`.

---

## 6. Migration des données existantes

Un script de migration automatique :
1. Parcourt tous les `Product` existants.
2. Pour chaque produit sans variante, crée une `ProductVariant` par défaut :
   - `colorName` : nom inféré à partir de la teinte principale `swatch`.
   - `colorHex` : valeur de `swatch`.
   - `stock` : valeur du champ `stock` du produit.
   - `active` : true.
3. Rétablit la cohérence pour que 100% des produits existants fonctionnent immédiatement dans le nouveau système.

---

## 7. Plan de vérification & Tests

- **Tests unitaires (Vitest)** :
  - `lib/colors/catalog.test.ts` : recherche par alias, insensible aux accents, extraction par famille.
  - `lib/colors/shades.test.ts` : génération des nuances HSL, bornage de la saturation et de la luminosité, validité des codes HEX retournés.
  - `lib/orders/stockCheck.test.ts` : agrégation et vérification de stock par variante.
  - `lib/store/cartLogic.test.ts` : ajout de variantes distinctes d'un même produit dans le panier.
- **Tests d'intégration Server Actions** :
  - Création et mise à jour d'un produit avec ses variantes (`createProduct`, `updateProductVariants`).
  - Décrémentation atomique de la variante lors d'une vente caisse (`encaisserVente`).
  - Décrémentation de la variante lors de la confirmation d'une commande web (`confirmOrder`).
  - Vérification de la non-décrémentation en cas de commande rejetée (`rejectOrder`).
  - Vérification de la conservation des données de variante sur une ancienne commande après désactivation ou suppression de la variante catalogue.
