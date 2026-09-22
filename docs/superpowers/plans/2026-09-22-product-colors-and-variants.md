# Gestion Avancée des Couleurs et Variantes de Produits — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à la gérante et au personnel de gérer le stock par variante de couleur sur chaque produit, avec recherche intelligente et générateur de nuances local, sélection rapide en caisse (POS) et affichage élégant et accessible sur la vitrine client.

**Architecture:** Modèle relationnel normalisé `ProductVariant` relié à `Product` avec stock unitaire et maintien du stock total synchronisé ; dictionnaire riche local embarqué (+120 teintes avec alias) complété par une table `TenantCustomColor` pour les favoris et ajouts de la boutique ; calcul mathématique HSL de nuances locales ; déduction atomique du stock à l'encaissement POS et à la validation des commandes en ligne ; copie figée de la couleur dans `OrderLine` pour une intégrité historique absolue.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma ORM, PostgreSQL (Supabase), Zustand, Tailwind CSS, Vitest.

## Global Constraints

- Langue produit : Français (libellés, notifications, messages d'erreur). Code, commits, identifiants : Anglais.
- TypeScript strict, aucun `any`.
- Zéro dépendance API externe pour le moteur de couleurs (100% hors-ligne et autonome).
- Ne jamais déduire le stock d'une commande web avant la validation explicite par la gérante.
- Ne jamais supprimer les informations historiques nécessaires à une commande passée (`onDelete: SetNull` + copies figées `variantName` et `colorHex` dans `OrderLine`).
- Accessibilité : le nom textuel de la couleur doit toujours être affiché (jamais la pastille visuelle seule).

---

### Task 1: Modèle Prisma, migration et rétrocompatibilité des produits existants

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260922100000_add_product_variants_and_custom_colors/migration.sql`
- Create: `scripts/backfill-product-variants.ts`
- Test: `lib/inventory/variantsMigration.test.ts`

**Interfaces:**
- Produces: types Prisma régénérés `ProductVariant`, `TenantCustomColor`, relations dans `Product`, `OrderLine`, `StockMovement`.

- [ ] **Step 1: Écrire le test unitaire pour la logique de migration des variantes par défaut**

```ts
// lib/inventory/variantsMigration.test.ts
import { describe, it, expect } from "vitest";

interface LegacyProduct {
  id: string;
  name: string;
  swatch: string;
  colors: string[];
  stock: number;
}

export function buildDefaultVariantForProduct(product: LegacyProduct) {
  const colorHex = product.swatch || (product.colors && product.colors[0]) || "#1E1B18";
  return {
    productId: product.id,
    colorName: "Couleur unique",
    colorHex,
    stock: Math.max(0, product.stock || 0),
    active: true,
    position: 0,
  };
}

describe("buildDefaultVariantForProduct", () => {
  it("génère une variante par défaut avec la couleur et le stock actuel", () => {
    const prod: LegacyProduct = { id: "p1", name: "Foulard Soie", swatch: "#6B1D2F", colors: ["#6B1D2F"], stock: 10 };
    const variant = buildDefaultVariantForProduct(prod);
    expect(variant.productId).toBe("p1");
    expect(variant.colorHex).toBe("#6B1D2F");
    expect(variant.stock).toBe(10);
    expect(variant.active).toBe(true);
  });
});
```

- [ ] **Step 2: Exécuter le test pour vérifier son passage**

Run: `npx vitest run lib/inventory/variantsMigration.test.ts`
Expected: PASS

- [ ] **Step 3: Mettre à jour le schéma Prisma (`prisma/schema.prisma`)**

Ajouter `ProductVariant`, `TenantCustomColor`, et les champs associés sur `Product`, `OrderLine`, `StockMovement` :
```prisma
model ProductVariant {
  id         String   @id @default(cuid())
  productId  String
  colorName  String
  colorHex   String
  stock      Int      @default(0)
  sku        String?
  image      String?
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

model TenantCustomColor {
  id         String   @id @default(cuid())
  tenantId   String
  name       String
  hex        String
  family     String?
  isFavorite Boolean  @default(false)
  createdAt  DateTime @default(now())

  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, name])
  @@index([tenantId])
}
```
Et mettre à jour `Product`, `OrderLine`, `StockMovement` pour inclure les relations correspondantes.

- [ ] **Step 4: Générer le client Prisma et créer le script de reprise de données**

Run: `npx prisma generate`
Créer `scripts/backfill-product-variants.ts` pour générer automatiquement une `ProductVariant` pour tout produit orphelin de variante.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/inventory/ scripts/
git commit -m "feat(db): add ProductVariant and TenantCustomColor models with backfill script"
```

---

### Task 2: Moteur de Couleurs & Algorithme de Nuances HSL

**Files:**
- Create: `lib/colors/catalog.ts`
- Create: `lib/colors/shades.ts`
- Test: `lib/colors/catalog.test.ts`
- Test: `lib/colors/shades.test.ts`

**Interfaces:**
- Produces:
  - `export interface ColorEntry { name: string; hex: string; family: string; aliases: string[]; }`
  - `export function searchColors(query: string, customColors?: Array<{ name: string; hex: string }>): ColorEntry[]`
  - `export interface ShadeOption { label: string; hex: string; role: "ref" | "light" | "dark" | "vivid" | "soft"; }`
  - `export function generateShades(baseHex: string, baseName: string): ShadeOption[]`

- [ ] **Step 1: Écrire les tests unitaires pour `catalog.ts` et `shades.ts`**

```ts
// lib/colors/catalog.test.ts
import { describe, it, expect } from "vitest";
import { searchColors, COLOR_CATALOG } from "./catalog";

describe("searchColors", () => {
  it("trouve 'Bordeaux' par nom exact ou alias 'Burgundy'", () => {
    const res1 = searchColors("bordeaux");
    expect(res1.some((c) => c.name === "Bordeaux")).toBe(true);

    const res2 = searchColors("burgundy");
    expect(res2.some((c) => c.name === "Bordeaux")).toBe(true);
  });

  it("trouve 'Terracotta' avec recherche partielle insensible aux accents", () => {
    const res = searchColors("terra");
    expect(res.some((c) => c.name === "Terracotta")).toBe(true);
  });
});
```

```ts
// lib/colors/shades.test.ts
import { describe, it, expect } from "vitest";
import { generateShades, hexToHsl, hslToHex } from "./shades";

describe("generateShades", () => {
  it("génère 5 nuances valides au format HEX #xxxxxx", () => {
    const shades = generateShades("#6B1D2F", "Bordeaux");
    expect(shades).toHaveLength(5);
    shades.forEach((s) => {
      expect(s.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
    expect(shades.some((s) => s.role === "ref")).toBe(true);
    expect(shades.some((s) => s.role === "light")).toBe(true);
    expect(shades.some((s) => s.role === "dark")).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec initial des tests**

Run: `npx vitest run lib/colors/`
Expected: FAIL ("Cannot find module ./catalog")

- [ ] **Step 3: Implémenter `lib/colors/catalog.ts` et `lib/colors/shades.ts`**

Créer `lib/colors/catalog.ts` avec le référentiel complet (+120 teintes textiles) et `searchColors`.
Créer `lib/colors/shades.ts` avec les conversions mathématiques HSL et la génération des variations.

- [ ] **Step 4: Exécuter les tests unitaires**

Run: `npx vitest run lib/colors/`
Expected: PASS (tous les tests valident la recherche et le calcul de nuances)

- [ ] **Step 5: Commit**

```bash
git add lib/colors/
git commit -m "feat(colors): add color catalog and HSL shades generation engine"
```

---

### Task 3: Actions serveur pour Variantes & Couleurs Personnalisées

**Files:**
- Modify: `lib/validators/product.ts`
- Create: `lib/validators/colors.ts`
- Modify: `lib/inventory/actions.ts`
- Create: `lib/colors/actions.ts`
- Test: `lib/inventory/actions.test.ts`
- Test: `lib/colors/actions.test.ts`

**Interfaces:**
- Consumes: `ProductVariant` de Prisma, `searchColors` de `lib/colors/catalog`.
- Produces:
  - `saveCustomColor(input: CustomColorInput)`
  - `toggleFavoriteColor(colorId: string)`
  - `getTenantColors(): Promise<{ custom: TenantCustomColor[]; favorites: TenantCustomColor[] }>`
  - `createProduct` et `updateProductVariants(productId: string, variants: VariantInput[])`

- [ ] **Step 1: Écrire les tests pour la validation des variantes et des couleurs personnalisées**

```ts
// lib/validators/product.test.ts
import { describe, it, expect } from "vitest";
import { productVariantSchema } from "./product";

describe("productVariantSchema", () => {
  it("valide une variante de couleur correcte", () => {
    const res = productVariantSchema.safeParse({
      colorName: "Bordeaux",
      colorHex: "#6B1D2F",
      stock: 8,
      active: true,
    });
    expect(res.success).toBe(true);
  });

  it("rejette un stock négatif ou un hex invalide", () => {
    const res = productVariantSchema.safeParse({
      colorName: "Bordeaux",
      colorHex: "not-a-hex",
      stock: -5,
    });
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Exécuter pour vérifier l'échec initial**

Run: `npx vitest run lib/validators/product.test.ts`
Expected: FAIL

- [ ] **Step 3: Mettre à jour les validateurs et implémenter les Server Actions**

Mettre à jour `lib/validators/product.ts` pour inclure le tableau de variantes.
Adapter `createProduct` dans `lib/inventory/actions.ts` pour insérer les variantes en transaction et recalculer le stock total.
Créer `updateProductVariants` pour synchroniser les variantes (créer, modifier le stock, activer/désactiver).
Créer `lib/colors/actions.ts` pour `saveCustomColor` et `getTenantColors`.

- [ ] **Step 4: Exécuter la suite de tests**

Run: `npx vitest run lib/validators/product.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validators/ lib/inventory/ lib/colors/
git commit -m "feat(actions): add variant management and tenant custom colors actions"
```

---

### Task 4: Déduction de Stock Atomique par Variante (POS & Commandes Web)

**Files:**
- Modify: `lib/orders/stockCheck.ts`
- Modify: `lib/orders/buildOrderLines.ts`
- Modify: `lib/orders/actions.ts` (`submitWebOrder`, `confirmOrder`)
- Modify: `lib/pos/actions.ts` (`encaisserVente`)
- Test: `lib/orders/stockCheck.test.ts`
- Test: `lib/orders/actions.test.ts`
- Test: `lib/pos/actions.test.ts`

**Interfaces:**
- Consumes: `ProductVariant` stock, `OrderLineData.variantId`.
- Produces: décrémentation ciblée sur `ProductVariant.stock` avec synchronisation de `Product.stock`.

- [ ] **Step 1: Écrire les tests unitaires pour la vérification du stock par variante**

```ts
// lib/orders/stockCheck.test.ts
import { describe, it, expect } from "vitest";
import { aggregateQtyByVariant } from "./stockCheck";

describe("aggregateQtyByVariant", () => {
  it("agrège les quantités par variantId", () => {
    const lines = [
      { productId: "p1", variantId: "v1", qty: 2, nameAtOrder: "Foulard Bordeaux" },
      { productId: "p1", variantId: "v1", qty: 3, nameAtOrder: "Foulard Bordeaux" },
      { productId: "p1", variantId: "v2", qty: 1, nameAtOrder: "Foulard Bleu" },
    ];
    const map = aggregateQtyByVariant(lines);
    expect(map.get("v1")?.qty).toBe(5);
    expect(map.get("v2")?.qty).toBe(1);
  });
});
```

- [ ] **Step 2: Exécuter le test pour vérifier l'échec initial**

Run: `npx vitest run lib/orders/stockCheck.test.ts`
Expected: FAIL

- [ ] **Step 3: Adapter `stockCheck.ts`, `buildOrderLines.ts`, `orders/actions.ts` et `pos/actions.ts`**

- Dans `buildOrderLines.ts` : ajouter `variantId?: string`, `variantName?: string`, `colorHex?: string` aux lignes.
- Dans `orders/actions.ts` :
  - `submitWebOrder` : enregistre `variantId`, `variantName`, `colorHex` dans `OrderLine`.
  - `confirmOrder` : décrémente `ProductVariant.stock` pour les `variantId` demandés, puis recalcule `Product.stock = sum(variants.stock)`.
- Dans `pos/actions.ts` :
  - `encaisserVente` : décrémente directement la `ProductVariant` concernée et émet le ticket avec le nom de la couleur.

- [ ] **Step 4: Exécuter les tests de commandes et de POS**

Run: `npx vitest run lib/orders/ lib/pos/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/orders/ lib/pos/
git commit -m "feat(stock): decrement atomic variant stock on POS sales and confirmed web orders"
```

---

### Task 5: Interface Back-Office — Éditeur de Variantes & Sélecteur de Nuances

**Files:**
- Create: `components/dashboard/ProductVariantsField.tsx`
- Create: `components/dashboard/CustomColorModal.tsx`
- Modify: `components/dashboard/screens/InventoryScreen.tsx`
- Test: `components/dashboard/ProductVariantsField.test.ts`

**Interfaces:**
- Consumes: `generateShades`, `searchColors` de `lib/colors/`, `getTenantColors` de `lib/colors/actions`.
- Produces: composant réutilisable pour ajouter/ajuster les variantes de couleur d'un produit avec leur stock unitaire.

- [ ] **Step 1: Écrire le test logique pour le composant de gestion des variantes**

Tester la mise à jour des stocks unitaires et le calcul du stock total consolidé.

- [ ] **Step 2: Implémenter `CustomColorModal.tsx`**

Modal permettant la sélection d'une couleur libre, la saisie d'un code HEX, le nom commercial personnalisé et l'option de sauvegarde dans les favoris boutique.

- [ ] **Step 3: Implémenter `ProductVariantsField.tsx`**

- Champ de recherche de couleur avec affichage instantané des pastilles de nuances générées.
- Liste des variantes : pastille visuelle, nom commercial, champ stock numérique (`NumericField`), upload photo optionnelle, interrupteur d'activation, bouton supprimer.
- Raccourcis pour les couleurs récentes et favorites.

- [ ] **Step 4: Intégrer dans `InventoryScreen.tsx`**

- Remplacer le sélecteur monochrome actuel par `ProductVariantsField` dans le drawer de création et d'édition.
- Afficher la pastille et la ventilation des couleurs dans le tableau d'inventaire.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/
git commit -m "feat(ui): add ProductVariantsField and CustomColorModal in backoffice inventory"
```

---

### Task 6: Caisse POS — Tiroir de Sélection Rapide de Variante

**Files:**
- Create: `components/pos/PosVariantPickerModal.tsx`
- Modify: `components/dashboard/screens/PosScreen.tsx`
- Modify: `components/dashboard/TicketModal.tsx`
- Test: `components/pos/posVariantSelection.test.ts`

**Interfaces:**
- Consumes: `product.variants` dans le panier de caisse.
- Produces: ouverture d'un pop-in de choix de couleur si produit multi-variantes, ajout direct si mono-variante.

- [ ] **Step 1: Écrire le test de sélection pour le POS**

Vérifier qu'un produit avec 1 seule variante active s'ajoute directement, et qu'un produit avec plusieurs variantes déclenche le modal.

- [ ] **Step 2: Implémenter `PosVariantPickerModal.tsx`**

Modal compact tactile : titre du produit, pastilles de couleur avec nom et stock disponible (`8 dispo`, `épuisé`).

- [ ] **Step 3: Intégrer dans `PosScreen.tsx` et mettre à jour `TicketModal.tsx`**

- Connecter le clic sur un produit au modal de sélection de variante.
- Afficher le nom de la variante sur chaque ligne du ticket de caisse.

- [ ] **Step 4: Commit**

```bash
git add components/pos/ components/dashboard/screens/PosScreen.tsx components/dashboard/TicketModal.tsx
git commit -m "feat(pos): add quick variant picker modal and variant label on receipts"
```

---

### Task 7: Vitrine Client — Fiche Produit, Panier & Checkout

**Files:**
- Modify: `components/storefront/views/ProductView.tsx`
- Modify: `lib/store/cartLogic.ts`
- Modify: `components/storefront/views/CartView.tsx`
- Modify: `components/storefront/views/CheckoutView.tsx`
- Test: `lib/store/cartLogic.test.ts`

**Interfaces:**
- Consumes: `Product.variants`, `cartKey(productId, variantId)`.
- Produces: pastilles avec limitation aux 5 premières + bouton `+X`, nom accessible, bascule photo produit, blocage si stock = 0.

- [ ] **Step 1: Écrire les tests unitaires pour la gestion de panier par variante**

```ts
// lib/store/cartLogic.test.ts
import { describe, it, expect } from "vitest";
import { addLine, cartKey } from "./cartLogic";

describe("cartLogic with variants", () => {
  it("génère une clé distincte par variante et permet d'ajouter deux couleurs du même produit", () => {
    const k1 = cartKey("p1", "v-bordeaux");
    const k2 = cartKey("p1", "v-bleunuit");
    expect(k1).not.toBe(k2);

    let cart = addLine([], { productId: "p1", variantId: "v-bordeaux", name: "Foulard", variant: "Bordeaux", colorHex: "#6B1D2F", price: 15000 });
    cart = addLine(cart, { productId: "p1", variantId: "v-bleunuit", name: "Foulard", variant: "Bleu nuit", colorHex: "#1A244D", price: 15000 });
    expect(cart).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Exécuter les tests de panier pour vérifier le passage**

Run: `npx vitest run lib/store/cartLogic.test.ts`
Expected: PASS

- [ ] **Step 3: Mettre à jour `ProductView.tsx`**

- Remplacer la boucle brute de couleurs par la liste des variantes actives.
- Afficher les 5 premières pastilles + bouton `+X autres` pour déplier le reste sans surcharger.
- Afficher textuellement le nom de la couleur sélectionnée (`Couleur — Bordeaux`).
- Si la variante a une photo dédiée (`variant.image`), faire basculer la photo principale dessus.
- Si le stock de la variante est à 0 : afficher `Épuisé pour cette couleur` et désactiver les boutons d'ajout.

- [ ] **Step 4: Mettre à jour `CartView.tsx` et `CheckoutView.tsx`**

Afficher la pastille et le nom de la couleur sélectionnée sous le titre du produit sur chaque ligne de commande.

- [ ] **Step 5: Commit**

```bash
git add components/storefront/ lib/store/
git commit -m "feat(storefront): enhance ProductView with variants, accessibility, dynamic photos and cart keys"
```

---

### Task 8: Validation Globale & Suite de Tests

**Files:**
- Run: `npm test`
- Run: `npm run typecheck`
- Run: `npm run build`

- [ ] **Step 1: Exécuter la suite complète de tests Vitest**

Run: `npm test`
Expected: PASS (toutes les suites existantes + nouvelles passent sans régression)

- [ ] **Step 2: Vérifier le typage TypeScript**

Run: `npm run typecheck`
Expected: Code 0 (zéro erreur TypeScript)

- [ ] **Step 3: Valider le build de production Next.js**

Run: `npm run build`
Expected: Build réussi sans erreur

- [ ] **Step 4: Commit final de stabilisation**

```bash
git commit --allow-empty -m "chore: verify full test suite and build for product colors and variants"
```
