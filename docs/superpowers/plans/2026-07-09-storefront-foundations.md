# Storefront Foundations Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the non-visual foundations the Vitrine storefront will sit on: an enriched shared catalogue, KYC validation, multi-tenant/zone resolution, a shared order+stock engine, and the back-office retouches that plug into it — so the back-office keeps working (now sourcing orders/stock from the new shared engine) even before any storefront page exists.

**Architecture:** Business logic lives in small pure TypeScript modules (`*Logic.ts` / selectors) that are unit-tested directly with Vitest, with zero DOM/browser dependency. Zustand stores are thin glue around that logic, adding persistence (localStorage, tenant-scoped, SSR-safe via `skipHydration` + manual rehydrate). Zone/tenant resolution follows the same pure-function-plus-thin-glue split: `lib/proxy/zones.ts` and `lib/tenant/registry.ts` are pure and tested; `proxy.ts` (the Next.js request entry point) is untested glue, verified manually. This plan produces a **second, independently reviewable plan** (`docs/superpowers/plans/<next>-storefront-ui.md`) covering the actual Vitrine pages/components, which consume exactly the interfaces locked here.

**Tech Stack:** Next.js 16.2 (App Router, `proxy.ts`), React 19.2, TypeScript strict, Zustand 5 (+ `persist` middleware), Zod 4 (KYC validation), Vitest 4 (unit tests, Node environment, no jsdom).

## Global Constraints

- Stock is deducted **only** when an order transitions to `confirmee` via `confirmOrder` — never on submission, never elsewhere. (CLAUDE.md §4, §9)
- Order totals are **always recomputed** from line items in store logic — never trusted from client input. (CLAUDE.md §9)
- The shop is based in **Abidjan, Côte d'Ivoire (+225)**, but customers may order from anywhere in the sub-region or beyond — the KYC phone field must accept **free international input**, no hardcoded country prefix in validation or defaults.
- TypeScript `strict`; **never** use `any` (prefer `unknown` + narrowing).
- Product-facing copy in French; code identifiers and commit messages in English. **Comments follow the existing codebase convention, which is French** (see `lib/format.ts`, `lib/data/catalog.ts`, `lib/theme/tokens.ts`) — French comments are correct and must not be flagged; CLAUDE.md mandates English only for identifiers/commits, not comments.
- The existing `(dashboard)` route folder and its internal paths (`/pos`, `/commandes`, etc.) are **not renamed**.
- No Supabase, Prisma, real authentication, or PWA/service-worker work in this plan — mock/client-side only, as decided in the spec.
- Every new pure-logic module ships with Vitest tests before the glue code that wires it up (TDD for logic; UI is verified manually per project convention, covered in Plan 2).
- Reference spec: `docs/superpowers/specs/2026-07-09-vitrine-storefront-design.md`.

---

## File Structure Overview

```
package.json                       MODIFY — add zod dep, vitest devDep, "test" script
vitest.config.ts                   CREATE — Node-environment Vitest config with "@/" alias

lib/format.test.ts                 CREATE — first real Vitest suite (existing fmt/money/initials)

lib/data/types.ts                  MODIFY — extend Product, ProductCategory, OrderLine
lib/data/catalog.ts                MODIFY — enrich all 12 products + add selectors
lib/data/catalog.test.ts           CREATE
lib/data/orders.ts                 MODIFY — add productId to every OrderLine

lib/validators/kyc.ts              CREATE — Zod schema + validateKyc()
lib/validators/kyc.test.ts         CREATE

lib/tenant/types.ts                CREATE — Tenant, ThemeTokens
lib/tenant/registry.ts             CREATE — TENANTS, resolveTenantFromHost
lib/tenant/registry.test.ts        CREATE
lib/tenant/index.ts                CREATE — getCurrentTenant() (server)

lib/auth/index.ts                  CREATE — Zone, Session, getSession, requireZone
lib/auth/index.test.ts             CREATE

lib/proxy/zones.ts                 CREATE — resolveZone, isPathAllowedForZone
lib/proxy/zones.test.ts            CREATE
proxy.ts                           CREATE (repo root) — Next proxy wiring zones+tenant+auth

lib/store/shopLogic.ts             CREATE — pure order/stock logic
lib/store/shopLogic.test.ts        CREATE
lib/store/useShop.ts               CREATE — Zustand store (persisted, tenant-scoped)

lib/store/cartLogic.ts             CREATE — pure storefront cart logic
lib/store/cartLogic.test.ts        CREATE
lib/store/useStorefront.ts         CREATE — Zustand store (persisted cart + block editor UI)

components/HydrateStores.tsx       CREATE — client-only rehydration for both stores
app/layout.tsx                     MODIFY — mount <HydrateStores />

components/dashboard/screens/OrdersScreen.tsx   MODIFY — read/act via useShop
lib/store/useNewOrdersCount.ts                   MODIFY — read via useShop
lib/store/useBackoffice.ts                       MODIFY — remove orderStatus/autoValidate (migrated)
components/dashboard/screens/InventoryScreen.tsx MODIFY — show effective (deducted) stock

app/page.tsx                       MODIFY — replace the /pos redirect with a storefront placeholder
app/(admin)/boutiques/page.tsx      CREATE — minimal super-admin zone placeholder
```

---

### Task 1: Vitest tooling + Zod dependency

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/format.test.ts`

**Interfaces:**
- Consumes: existing `fmt`, `money`, `initials` from `lib/format.ts` (unchanged).
- Produces: `npm run test` command, `@/` path alias resolvable in Vitest, available to every later task's test files.

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install zod@^4.4.3
npm install -D vitest@^4.1.10
```
Expected: `package.json` now lists `"zod": "^4.4.3"` under `dependencies` and `"vitest": "^4.1.10"` under `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Add the `test` script**

Edit `package.json` — in `"scripts"`, add a `test` entry:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
```

- [ ] **Step 4: Write the failing test (first real suite, not a throwaway smoke test)**

Create `lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fmt, money, initials } from "@/lib/format";

describe("fmt", () => {
  it("groups thousands with a narrow no-break space (current toLocaleString('fr-FR') behavior)", () => {
    expect(fmt(12500).replace(/\s/g, " ")).toBe("12 500");
  });

  it("does not add a separator under 1000", () => {
    expect(fmt(500)).toBe("500");
  });
});

describe("money", () => {
  it("appends the FCFA suffix", () => {
    expect(money(22000).replace(/\s/g, " ")).toBe("22 000 FCFA");
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(initials("Aya Koffi")).toBe("AK");
  });

  it("handles a single word", () => {
    expect(initials("Madame")).toBe("M");
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm run test -- lib/format.test.ts`
Expected: `4 passed` (all four `it` blocks green). The `fmt`/`money` assertions normalise whitespace (`.replace(/\s/g, " ")`) before comparing, so they pass whether `toLocaleString('fr-FR')` emits a regular space or a narrow no-break space (U+202F) — do **not** modify `lib/format.ts` here (a separate pre-existing formatting issue is already flagged elsewhere and is out of scope for this task).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/format.test.ts
git commit -m "test: add Vitest tooling and cover existing format helpers"
```

---

### Task 2: Extend shared data types

**Files:**
- Modify: `lib/data/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ProductCategory` (now includes `"Turbans"`), extended `Product` (adds `colors`, `motif`, `lengths`, `description`, `oldPrice?`, `badge?`, `featured?`), extended `OrderLine` (adds required `productId: string`). These are the types every later task (catalog, shopLogic, storefront views) is written against.

- [ ] **Step 1: Replace the file contents**

Replace `lib/data/types.ts` in full:

```ts
export type ProductCategory = "Foulards" | "Turbans" | "Tissus" | "Accessoires";

export interface Product {
  id: string;
  cat: ProductCategory;
  name: string;
  variant: string;
  price: number;
  stock: number;
  /** Motif de fond servant de vignette produit (mock, sans image). */
  swatch: string;
  /** Couleurs disponibles (hex) ; la première sert de teinte principale pour le dégradé vignette. */
  colors: string[];
  /** Motif textile (Wax, Bazin, Uni, Kente…) — utilisé par les filtres vitrine. */
  motif: string;
  /** Longueurs/tailles disponibles (ex. ["90 × 90 cm", "Sur-mesure"] ou ["Taille unique"]). */
  lengths: string[];
  /** Description longue affichée sur la fiche produit. */
  description: string;
  /** Prix barré éventuel (ex. article en promotion). */
  oldPrice?: number;
  /** Étiquette courte affichée sur la vignette ("Nouveau", "★ VIP"…). */
  badge?: string;
  /** Marque ce produit comme le "produit vedette" de la Home. Un seul produit devrait le porter. */
  featured?: boolean;
}

export type CustomerSegment = "VIP" | "Fidèle" | "Nouvelle";

export interface Customer {
  id: string;
  name: string;
  initials: string;
  phone: string;
  place: string;
  points: number;
  orders: number;
  spent: string;
  vip: boolean;
  seg: CustomerSegment;
}

export type OrderStatus =
  | "nouvelle"
  | "confirmee"
  | "preparation"
  | "livree"
  | "refusee";

export interface OrderLine {
  name: string;
  qty: number;
  price: string;
  total: string;
  /** Référence catalogue de l'article — nécessaire pour déduire le stock à la validation. */
  productId: string;
}

export type OrderChannel = "Web" | "WhatsApp" | "Boutique";

export interface Order {
  id: string;
  cid: string;
  client: string;
  place: string;
  phone: string;
  items: number;
  channel: OrderChannel;
  ago: string;
  date: string;
  total: string;
  status: OrderStatus;
  vip: boolean;
  lines: OrderLine[];
}
```

- [ ] **Step 2: Typecheck (this will fail — expected, next task fixes it)**

Run: `npm run typecheck`
Expected: errors in `lib/data/orders.ts` — each `OrderLine` literal is missing the now-required `productId`. This confirms the type is wired correctly; Task 3 fixes the data.

- [ ] **Step 3: Commit**

```bash
git add lib/data/types.ts
git commit -m "feat: extend Product and OrderLine types for the storefront"
```

---

### Task 3: Enrich the catalogue + wire existing orders to real products

**Files:**
- Modify: `lib/data/catalog.ts`
- Modify: `lib/data/orders.ts`
- Create: `lib/data/catalog.test.ts`

**Interfaces:**
- Consumes: `Product`, `ProductCategory` from `lib/data/types.ts` (Task 2).
- Produces: enriched `catalog: Product[]` (same 12 ids `p1…p12`, `p3` recategorized to `"Turbans"`), `categories` (adds `"Turbans"`), `storefrontCategories: ("Foulards"|"Turbans"|"Accessoires")[]`, and pure selectors `newestProducts(limit?)`, `featuredProduct()`, `relatedTo(productId, limit?)`, `filterCatalog(filters: CatalogFilters)` with `CatalogFilters` exported — all consumed directly by Plan 2's storefront views and by this plan's `shopLogic.ts` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `lib/data/catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  catalog,
  categories,
  storefrontCategories,
  newestProducts,
  featuredProduct,
  relatedTo,
  filterCatalog,
} from "@/lib/data/catalog";

describe("catalog", () => {
  it("keeps the original 12 product ids", () => {
    expect(catalog.map((p) => p.id)).toEqual([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12",
    ]);
  });

  it("recategorizes the turban (p3) out of Foulards", () => {
    const p3 = catalog.find((p) => p.id === "p3")!;
    expect(p3.cat).toBe("Turbans");
  });

  it("exposes Turbans in the full category list and in storefrontCategories", () => {
    expect(categories).toContain("Turbans");
    expect(storefrontCategories).toEqual(["Foulards", "Turbans", "Accessoires"]);
  });
});

describe("newestProducts", () => {
  it("returns badged products first, in catalog order", () => {
    expect(newestProducts(4).map((p) => p.id)).toEqual(["p1", "p2", "p7", "p10"]);
  });

  it("respects the limit", () => {
    expect(newestProducts(2).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("featuredProduct", () => {
  it("returns the product flagged featured", () => {
    expect(featuredProduct().id).toBe("p2");
  });
});

describe("relatedTo", () => {
  it("returns same-category products excluding the product itself", () => {
    expect(relatedTo("p2").map((p) => p.id)).toEqual(["p1", "p4"]);
  });

  it("returns an empty array for an unknown id", () => {
    expect(relatedTo("nope")).toEqual([]);
  });
});

describe("filterCatalog", () => {
  const base = { cat: "Tous" as const, color: "", motif: "", priceMax: 999999, query: "", sort: "new" as const };

  it("returns everything with no filters", () => {
    expect(filterCatalog(base)).toHaveLength(12);
  });

  it("filters by category", () => {
    expect(filterCatalog({ ...base, cat: "Turbans" }).map((p) => p.id)).toEqual(["p3"]);
  });

  it("filters by color (gold present on p3, absent on p4)", () => {
    const result = filterCatalog({ ...base, color: "#C9A227" }).map((p) => p.id);
    expect(result).toContain("p3");
    expect(result).not.toContain("p4");
  });

  it("filters by motif", () => {
    expect(filterCatalog({ ...base, motif: "Kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("filters by max price inclusive", () => {
    expect(filterCatalog({ ...base, priceMax: 8000 }).map((p) => p.id)).toEqual(["p4", "p9", "p10", "p12"]);
  });

  it("filters by free-text query on name or motif", () => {
    expect(filterCatalog({ ...base, query: "kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("sorts ascending by price", () => {
    expect(filterCatalog({ ...base, cat: "Accessoires", sort: "asc" }).map((p) => p.id)).toEqual([
      "p9", "p10", "p12", "p11",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/data/catalog.test.ts`
Expected: FAIL — `catalog.ts` doesn't yet export `storefrontCategories`, `newestProducts`, `featuredProduct`, `relatedTo`, `filterCatalog`, and `p3.cat` is still `"Foulards"`.

- [ ] **Step 3: Replace `lib/data/catalog.ts` in full**

```ts
import type { Product, ProductCategory } from "./types";

/** Catalogue produits (données de démonstration) — source unique partagée entre POS, inventaire et vitrine. */
export const catalog: Product[] = [
  { id: "p1", cat: "Foulards", name: "Foulard Wax Abidjan", variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "repeating-linear-gradient(45deg,#e6d9c4,#e6d9c4 8px,#efe6d6 8px,#efe6d6 16px)",
    colors: ["#26326B", "#D07A34", "#C9A227"], motif: "Wax", lengths: ["90 × 90 cm", "Sur-mesure"], badge: "Nouveau",
    description: "Coton wax authentique, imprimé vibrant inspiré des marchés d'Abidjan. Un incontournable du quotidien." },
  { id: "p2", cat: "Foulards", name: "Foulard soie Kente", variant: "Soie · 70×70", price: 22000, stock: 6, swatch: "repeating-linear-gradient(45deg,#d8c9e0,#d8c9e0 8px,#e6dcec 8px,#e6dcec 16px)",
    colors: ["#26326B", "#0E9F6E", "#C9A227"], motif: "Kente", lengths: ["70 × 70 cm", "Sur-mesure"], badge: "★ Coup de cœur", featured: true,
    description: "Soie fluide au toucher précieux, tissage Kente aux couleurs chaudes. Notre pièce signature, en édition limitée." },
  { id: "p3", cat: "Turbans", name: "Turban Bazin Or", variant: "Bazin · brodé", price: 18000, stock: 14, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)",
    colors: ["#C9A227", "#1E1B18"], motif: "Bazin", lengths: ["Taille unique"],
    description: "Bazin riche brodé main, éclat doré pour les grandes occasions." },
  { id: "p4", cat: "Foulards", name: "Foulard mousseline", variant: "Mousseline · 55×55", price: 7000, stock: 31, swatch: "repeating-linear-gradient(45deg,#d5e0dc,#d5e0dc 8px,#e4ece8 8px,#e4ece8 16px)",
    colors: ["#0E9F6E", "#26326B"], motif: "Uni", lengths: ["55 × 55 cm"],
    description: "Mousseline légère et respirante, l'essentiel du quotidien, doux et facile à nouer." },
  { id: "p5", cat: "Tissus", name: "Wax Vlisco 6 yards", variant: "Coton · 6 yd", price: 35000, stock: 9, swatch: "repeating-linear-gradient(45deg,#e0cfc0,#e0cfc0 8px,#ece0d4 8px,#ece0d4 16px)",
    colors: ["#D07A34", "#26326B"], motif: "Wax", lengths: ["6 yards"],
    description: "Wax Vlisco authentique, motifs vibrants pour vos tenues sur-mesure." },
  { id: "p6", cat: "Tissus", name: "Bazin riche", variant: "Damassé · 5 m", price: 28000, stock: 4, swatch: "repeating-linear-gradient(45deg,#cfd8e0,#cfd8e0 8px,#dfe6ec 8px,#dfe6ec 16px)",
    colors: ["#26326B", "#1E1B18"], motif: "Bazin", lengths: ["5 mètres"], oldPrice: 32000,
    description: "Bazin riche damassé, éclat soutenu, pour vos grandes occasions." },
  { id: "p7", cat: "Tissus", name: "Kente bande", variant: "Tissé main · 4 m", price: 40000, stock: 11, swatch: "repeating-linear-gradient(45deg,#e6c9c0,#e6c9c0 8px,#efdcd4 8px,#efdcd4 16px)",
    colors: ["#D07A34", "#C9A227", "#26326B"], motif: "Kente", lengths: ["4 mètres"], badge: "★ VIP",
    description: "Tissage Kente authentique, réalisé à la main, un drapé généreux et précieux." },
  { id: "p8", cat: "Tissus", name: "Pagne Woodin", variant: "Coton · 6 yd", price: 24000, stock: 17, swatch: "repeating-linear-gradient(45deg,#d0ddc9,#d0ddc9 8px,#e0ebda 8px,#e0ebda 16px)",
    colors: ["#0E9F6E", "#D07A34"], motif: "Wax", lengths: ["6 yards"],
    description: "Pagne Woodin coloré, coton de qualité pour vos créations sur-mesure." },
  { id: "p9", cat: "Accessoires", name: "Broche dorée", variant: "Laiton · plaqué", price: 4500, stock: 22, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)",
    colors: ["#C9A227"], motif: "Uni", lengths: ["Taille unique"],
    description: "Broche en laiton plaqué or, l'accent parfait pour relever un foulard ou un turban." },
  { id: "p10", cat: "Accessoires", name: "Boucles perles", variant: "Perles · fait main", price: 6000, stock: 3, swatch: "repeating-linear-gradient(45deg,#e0cfd6,#e0cfd6 8px,#ece0e6 8px,#ece0e6 16px)",
    colors: ["#D07A34", "#1E1B18"], motif: "Uni", lengths: ["Taille unique"], badge: "Nouveau",
    description: "Boucles d'oreilles en perles faites main, légères et élégantes." },
  { id: "p11", cat: "Accessoires", name: "Sac raphia", variant: "Raphia tressé", price: 15000, stock: 8, swatch: "repeating-linear-gradient(45deg,#e2d6bf,#e2d6bf 8px,#ece3d2 8px,#ece3d2 16px)",
    colors: ["#C9A227", "#26326B"], motif: "Uni", lengths: ["Taille unique"],
    description: "Sac en raphia tressé à la main, la touche artisanale qui complète toute tenue." },
  { id: "p12", cat: "Accessoires", name: "Pochette wax", variant: "Wax · doublée", price: 8000, stock: 19, swatch: "repeating-linear-gradient(45deg,#d9d2c4,#d9d2c4 8px,#e7e1d6 8px,#e7e1d6 16px)",
    colors: ["#D07A34", "#0E9F6E"], motif: "Wax", lengths: ["Taille unique"],
    description: "Pochette en wax doublée, pratique et colorée pour vos sorties." },
];

export const categories: Array<"Tous" | ProductCategory> = [
  "Tous",
  "Foulards",
  "Turbans",
  "Tissus",
  "Accessoires",
];

/** Catégories mises en avant sur la Home (les Tissus restent filtrables au catalogue mais hors vignettes). */
export const storefrontCategories: ProductCategory[] = ["Foulards", "Turbans", "Accessoires"];

/** Produits mis en avant sur la Home : les articles badgés d'abord, puis le reste, dans l'ordre du catalogue. */
export function newestProducts(limit = 4): Product[] {
  const badged = catalog.filter((p) => p.badge);
  const rest = catalog.filter((p) => !p.badge);
  return [...badged, ...rest].slice(0, limit);
}

/** Le produit vedette de la Home (le premier marqué `featured`, sinon le premier du catalogue). */
export function featuredProduct(): Product {
  return catalog.find((p) => p.featured) ?? catalog[0];
}

/** Produits de la même catégorie, hors le produit lui-même. */
export function relatedTo(productId: string, limit = 4): Product[] {
  const current = catalog.find((p) => p.id === productId);
  if (!current) return [];
  return catalog.filter((p) => p.cat === current.cat && p.id !== current.id).slice(0, limit);
}

export interface CatalogFilters {
  cat: "Tous" | ProductCategory;
  color: string;
  motif: string;
  priceMax: number;
  query: string;
  sort: "new" | "asc" | "desc";
}

/** Filtrage + tri du catalogue pour l'écran Catalogue de la vitrine. */
export function filterCatalog(filters: CatalogFilters): Product[] {
  let list = catalog.filter((p) => filters.cat === "Tous" || p.cat === filters.cat);
  if (filters.color) list = list.filter((p) => p.colors.includes(filters.color));
  if (filters.motif) list = list.filter((p) => p.motif === filters.motif);
  list = list.filter((p) => p.price <= filters.priceMax);
  const q = filters.query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.motif.toLowerCase().includes(q)
    );
  }
  if (filters.sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
  if (filters.sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
  return list;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/data/catalog.test.ts`
Expected: all suites PASS.

- [ ] **Step 5: Wire existing mock orders to real product ids**

Replace `lib/data/orders.ts` in full (adds `productId` to every line; no other change):

```ts
import type { Order } from "./types";

/** Commandes en ligne / boutique (données de démonstration). */
export const orders: Order[] = [
  {
    id: "#TER-0492", cid: "c1", client: "Aya Koffi", place: "Cocody, Abidjan", phone: "+225 07 12 45 67 89",
    items: 3, channel: "Web", ago: "il y a 12 min", date: "Aujourd'hui 09:42", total: "54 000 FCFA", status: "nouvelle", vip: true,
    lines: [
      { name: "Foulard soie Kente", qty: 1, price: "22 000", total: "22 000", productId: "p2" },
      { name: "Turban Bazin Or", qty: 1, price: "18 000", total: "18 000", productId: "p3" },
      { name: "Broche dorée", qty: 2, price: "4 500", total: "9 000", productId: "p9" },
    ],
  },
  {
    id: "#TER-0491", cid: "c4", client: "Fatou Bamba", place: "Marcory, Abidjan", phone: "+225 07 45 09 87 11",
    items: 2, channel: "WhatsApp", ago: "il y a 40 min", date: "Aujourd'hui 09:10", total: "31 000 FCFA", status: "nouvelle", vip: false,
    lines: [{ name: "Wax Vlisco 6 yards", qty: 1, price: "35 000", total: "35 000", productId: "p5" }],
  },
  {
    id: "#TER-0490", cid: "c5", client: "Aminata Koné", place: "Bouaké", phone: "+225 05 61 23 45 78",
    items: 1, channel: "Web", ago: "il y a 1 h", date: "Aujourd'hui 08:30", total: "12 500 FCFA", status: "nouvelle", vip: false,
    lines: [{ name: "Foulard Wax Abidjan", qty: 1, price: "12 500", total: "12 500", productId: "p1" }],
  },
  {
    id: "#TER-0489", cid: "c3", client: "Mariam Traoré", place: "Plateau, Abidjan", phone: "+225 01 88 76 54 32",
    items: 4, channel: "Web", ago: "il y a 2 h", date: "Aujourd'hui 07:55", total: "86 000 FCFA", status: "confirmee", vip: true,
    lines: [
      { name: "Kente bande", qty: 2, price: "40 000", total: "80 000", productId: "p7" },
      { name: "Pochette wax", qty: 1, price: "8 000", total: "8 000", productId: "p12" },
    ],
  },
  {
    id: "#TER-0488", cid: "c2", client: "Adjoua N’Guessan", place: "Yopougon, Abidjan", phone: "+225 05 33 21 09 44",
    items: 2, channel: "Boutique", ago: "il y a 3 h", date: "Hier 18:20", total: "27 500 FCFA", status: "preparation", vip: false,
    lines: [{ name: "Pagne Woodin", qty: 1, price: "24 000", total: "24 000", productId: "p8" }],
  },
  {
    id: "#TER-0487", cid: "c6", client: "Grace Kouassi", place: "Riviera, Abidjan", phone: "+225 01 19 82 73 64",
    items: 3, channel: "Web", ago: "hier", date: "Hier 15:02", total: "42 000 FCFA", status: "livree", vip: false,
    lines: [{ name: "Bazin riche", qty: 1, price: "28 000", total: "28 000", productId: "p6" }],
  },
  {
    id: "#TER-0486", cid: "c4", client: "Fatou Bamba", place: "Marcory, Abidjan", phone: "+225 07 45 09 87 11",
    items: 1, channel: "Web", ago: "hier", date: "Hier 11:40", total: "7 000 FCFA", status: "refusee", vip: false,
    lines: [{ name: "Foulard mousseline", qty: 1, price: "7 000", total: "7 000", productId: "p4" }],
  },
];
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors (the `OrderLine.productId` requirement from Task 2 is now satisfied everywhere).

- [ ] **Step 7: Commit**

```bash
git add lib/data/catalog.ts lib/data/catalog.test.ts lib/data/orders.ts
git commit -m "feat: enrich shared catalogue with storefront fields and wire orders to product ids"
```

---

### Task 4: KYC validation (Zod)

**Files:**
- Create: `lib/validators/kyc.ts`
- Create: `lib/validators/kyc.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `kycSchema` (Zod), `KycInput` (`z.infer`), `KycFieldErrors`, `validateKyc(input): { ok: true; data: KycInput } | { ok: false; errors: KycFieldErrors }` — consumed by `lib/store/shopLogic.ts` (Task 9) and by Plan 2's checkout view.

- [ ] **Step 1: Write the failing tests**

Create `lib/validators/kyc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateKyc } from "@/lib/validators/kyc";

const validBase = { name: "Awa Diallo", place: "Cocody, Abidjan", phone: "+225 07 12 45 67 89", note: "", wa: true };

describe("validateKyc", () => {
  it("accepts a valid Abidjan submission", () => {
    const result = validateKyc(validBase);
    expect(result.ok).toBe(true);
  });

  it("accepts a phone number with a different country code (sub-region / international customers)", () => {
    const result = validateKyc({ ...validBase, phone: "+33 6 12 34 56 78", place: "Paris, France" });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = validateKyc({ ...validBase, name: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeTruthy();
  });

  it("rejects an empty place", () => {
    const result = validateKyc({ ...validBase, place: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.place).toBeTruthy();
  });

  it("rejects a phone number that is too short", () => {
    const result = validateKyc({ ...validBase, phone: "123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toBeTruthy();
  });

  it("rejects a phone number containing letters", () => {
    const result = validateKyc({ ...validBase, phone: "call me maybe" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toBeTruthy();
  });

  it("trims whitespace from accepted fields", () => {
    const result = validateKyc({ ...validBase, name: "  Awa Diallo  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Awa Diallo");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/validators/kyc.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validators/kyc'`.

- [ ] **Step 3: Implement**

Create `lib/validators/kyc.ts`:

```ts
import { z } from "zod";

export const kycSchema = z.object({
  name: z.string().trim().min(2, "Merci d'indiquer votre nom."),
  place: z.string().trim().min(2, "Indiquez où livrer."),
  // Format international libre : la boutique est à Abidjan (+225) mais reçoit des
  // commandes de toute la sous-région ou d'ailleurs — pas de préfixe verrouillé.
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour vous joindre."),
  note: z.string().trim().optional().default(""),
  wa: z.boolean().default(true),
});

export type KycInput = z.infer<typeof kycSchema>;

export interface KycFieldErrors {
  name?: string;
  place?: string;
  phone?: string;
}

export interface KycRawInput {
  name: string;
  place: string;
  phone: string;
  note: string;
  wa: boolean;
}

export function validateKyc(
  input: KycRawInput
): { ok: true; data: KycInput } | { ok: false; errors: KycFieldErrors } {
  const result = kycSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: KycFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "place" || key === "phone") {
      errors[key] = issue.message;
    }
  }
  return { ok: false, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/validators/kyc.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validators/kyc.ts lib/validators/kyc.test.ts
git commit -m "feat: add KYC validation with free international phone input"
```

---

### Task 5: Tenant registry

**Files:**
- Create: `lib/tenant/types.ts`
- Create: `lib/tenant/registry.ts`
- Create: `lib/tenant/registry.test.ts`
- Create: `lib/tenant/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Tenant`, `ThemeTokens` types; `DEFAULT_TENANT`, `TENANTS`, `resolveTenantFromHost(host): Tenant` — consumed by `proxy.ts` (Task 8) and by `useShop`/`useStorefront` (Tasks 9–10) for storage-key scoping. `getCurrentTenant()` (server-only, async) is available for future Server Components (not yet consumed in this plan, wired for Plan 2).

- [ ] **Step 1: Create the Tenant types**

Create `lib/tenant/types.ts`:

```ts
export interface ThemeTokens {
  primaryColor: string;
  accentColor: string;
  logoText: string;
}

export interface Tenant {
  id: string;
  /** Sous-domaine canonique (ex. "foulard-teranga" → foulard-teranga.plateforme.app). */
  slug: string;
  name: string;
  theme: ThemeTokens;
  /** Hôtes additionnels mappés à ce tenant (domaines custom, alias locaux). */
  domains: string[];
}
```

- [ ] **Step 2: Write the failing tests**

Create `lib/tenant/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_TENANT, resolveTenantFromHost } from "@/lib/tenant/registry";

describe("resolveTenantFromHost", () => {
  it("resolves the default tenant for localhost", () => {
    expect(resolveTenantFromHost("localhost:3000").id).toBe(DEFAULT_TENANT.id);
  });

  it("resolves by canonical subdomain", () => {
    expect(resolveTenantFromHost("foulard-teranga.plateforme.app").id).toBe(DEFAULT_TENANT.id);
  });

  it("resolves by a registered custom domain", () => {
    expect(resolveTenantFromHost("foulard-teranga.localhost").id).toBe(DEFAULT_TENANT.id);
  });

  it("falls back to the default tenant for an unknown host", () => {
    expect(resolveTenantFromHost("unknown-shop.example.com").id).toBe(DEFAULT_TENANT.id);
  });

  it("is case-insensitive and ignores the port", () => {
    expect(resolveTenantFromHost("FOULARD-TERANGA.PLATEFORME.APP:8080").id).toBe(DEFAULT_TENANT.id);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- lib/tenant/registry.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 4: Implement the registry**

Create `lib/tenant/registry.ts`:

```ts
import type { Tenant } from "./types";

/**
 * v1 mono-boutique : un seul tenant. La résolution ci-dessous reste réelle
 * (host → tenant) pour que l'ajout d'un 2e tenant soit un ajout de données,
 * jamais une réécriture de cette logique.
 */
export const DEFAULT_TENANT: Tenant = {
  id: "foulard-teranga",
  slug: "foulard-teranga",
  name: "Foulard Teranga",
  theme: {
    primaryColor: "#26326B",
    accentColor: "#D07A34",
    logoText: "Foulard Teranga",
  },
  domains: ["localhost", "foulard-teranga.localhost"],
};

export const TENANTS: Tenant[] = [DEFAULT_TENANT];

function stripPort(host: string): string {
  return host.split(":")[0].toLowerCase();
}

export function resolveTenantFromHost(host: string): Tenant {
  const normalized = stripPort(host);

  const bySubdomain = TENANTS.find((t) => normalized === `${t.slug}.plateforme.app`);
  if (bySubdomain) return bySubdomain;

  const byDomain = TENANTS.find((t) => t.domains.includes(normalized));
  if (byDomain) return byDomain;

  return DEFAULT_TENANT;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- lib/tenant/registry.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 6: Add the server-only accessor**

Create `lib/tenant/index.ts`:

```ts
import { headers } from "next/headers";
import { DEFAULT_TENANT, TENANTS } from "./registry";
import type { Tenant } from "./types";

export type { Tenant, ThemeTokens } from "./types";
export { DEFAULT_TENANT, TENANTS, resolveTenantFromHost } from "./registry";

/** Lit le tenant résolu par `proxy.ts` (en-tête `x-tenant-id`) depuis un Server Component. */
export async function getCurrentTenant(): Promise<Tenant> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return DEFAULT_TENANT;
  return TENANTS.find((t) => t.id === tenantId) ?? DEFAULT_TENANT;
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/tenant
git commit -m "feat: add tenant registry and host resolution"
```

---

### Task 6: Auth placeholder (zones + session)

**Files:**
- Create: `lib/auth/index.ts`
- Create: `lib/auth/index.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Zone` (`"storefront" | "dashboard" | "admin"`), `Session`, `getSession(): Session`, `requireZone(zone: Zone): { allowed: boolean }` — consumed by `lib/proxy/zones.ts` (Task 7, for the `Zone` type) and `proxy.ts` (Task 8, for the guard call).

- [ ] **Step 1: Write the failing tests**

Create `lib/auth/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { requireZone } from "@/lib/auth";

describe("requireZone", () => {
  it("always allows the public storefront zone", () => {
    expect(requireZone("storefront").allowed).toBe(true);
  });

  it("allows the mock owner session into the dashboard zone", () => {
    expect(requireZone("dashboard").allowed).toBe(true);
  });

  it("does not allow the mock owner session into the super-admin zone", () => {
    expect(requireZone("admin").allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/auth/index.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/auth/index.ts`:

```ts
export type Zone = "storefront" | "dashboard" | "admin";
export type Role = "owner" | "staff" | "super_admin";

export interface Session {
  userId: string;
  name: string;
  role: Role;
}

/**
 * Placeholder v1 : pas d'authentification réelle. Renvoie toujours la même
 * session "gérante" mock. Quand Supabase Auth sera branché, seule cette
 * fonction change — les appelants (`requireZone`, `proxy.ts`) restent stables.
 */
export function getSession(): Session {
  return { userId: "owner-1", name: "Aïcha Koné", role: "owner" };
}

const ZONE_ROLES: Record<Exclude<Zone, "storefront">, Role[]> = {
  dashboard: ["owner", "staff"],
  admin: ["super_admin"],
};

export function requireZone(zone: Zone): { allowed: boolean } {
  if (zone === "storefront") return { allowed: true };
  const session = getSession();
  return { allowed: ZONE_ROLES[zone].includes(session.role) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/auth/index.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth
git commit -m "feat: add auth placeholder with zone-based access rules"
```

---

### Task 7: Zone resolution (host/path → zone)

**Files:**
- Create: `lib/proxy/zones.ts`
- Create: `lib/proxy/zones.test.ts`

**Interfaces:**
- Consumes: `Zone` from `lib/auth` (Task 6).
- Produces: `DASHBOARD_PATHS`, `ADMIN_PATHS`, `ADMIN_HOST_PREFIX`, `PLATFORM_HOST_PREFIX`, `resolveZone(hostname, pathname): { zone: Zone; rewrittenPathname: string }`, `isPathAllowedForZone(zone, pathname): boolean` — consumed by `proxy.ts` (Task 8).

- [ ] **Step 1: Write the failing tests**

Create `lib/proxy/zones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveZone, isPathAllowedForZone } from "@/lib/proxy/zones";

describe("resolveZone — dev (localhost, path-prefixed)", () => {
  it("treats the root as storefront", () => {
    expect(resolveZone("localhost:3000", "/")).toEqual({ zone: "storefront", rewrittenPathname: "/" });
  });

  it("strips /admin and resolves the dashboard zone", () => {
    expect(resolveZone("localhost:3000", "/admin/commandes")).toEqual({
      zone: "dashboard",
      rewrittenPathname: "/commandes",
    });
  });

  it("defaults bare /admin to /pos", () => {
    expect(resolveZone("localhost:3000", "/admin")).toEqual({ zone: "dashboard", rewrittenPathname: "/pos" });
  });

  it("strips /platform and resolves the admin zone", () => {
    expect(resolveZone("localhost:3000", "/platform/boutiques")).toEqual({
      zone: "admin",
      rewrittenPathname: "/boutiques",
    });
  });
});

describe("resolveZone — prod (host-based)", () => {
  it("resolves the dashboard zone from the admin. subdomain, path untouched", () => {
    expect(resolveZone("admin.foulard-teranga.com", "/commandes")).toEqual({
      zone: "dashboard",
      rewrittenPathname: "/commandes",
    });
  });

  it("resolves the admin zone from the platform. subdomain", () => {
    expect(resolveZone("platform.foulard-teranga.com", "/boutiques")).toEqual({
      zone: "admin",
      rewrittenPathname: "/boutiques",
    });
  });

  it("resolves the storefront zone for any other host", () => {
    expect(resolveZone("foulard-teranga.plateforme.app", "/catalogue")).toEqual({
      zone: "storefront",
      rewrittenPathname: "/catalogue",
    });
  });
});

describe("isPathAllowedForZone", () => {
  it("allows dashboard paths in the dashboard zone", () => {
    expect(isPathAllowedForZone("dashboard", "/pos")).toBe(true);
  });

  it("rejects a storefront path in the dashboard zone", () => {
    expect(isPathAllowedForZone("dashboard", "/catalogue")).toBe(false);
  });

  it("allows storefront paths in the storefront zone", () => {
    expect(isPathAllowedForZone("storefront", "/catalogue")).toBe(true);
  });

  it("rejects a dashboard path in the storefront zone", () => {
    expect(isPathAllowedForZone("storefront", "/pos")).toBe(false);
  });

  it("allows admin paths in the admin zone", () => {
    expect(isPathAllowedForZone("admin", "/boutiques")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/proxy/zones.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement**

Create `lib/proxy/zones.ts`:

```ts
import type { Zone } from "@/lib/auth";

export const DASHBOARD_PATHS = [
  "/pos",
  "/tableau-de-bord",
  "/commandes",
  "/inventaire",
  "/clientes",
  "/marketing",
  "/finance",
  "/personnalisation",
] as const;

export const ADMIN_PATHS = ["/boutiques"] as const;

export const ADMIN_HOST_PREFIX = "admin.";
export const PLATFORM_HOST_PREFIX = "platform.";

export interface ZoneResolution {
  zone: Zone;
  rewrittenPathname: string;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

function stripPrefix(pathname: string, prefix: string, fallback: string): string {
  const rest = pathname.slice(prefix.length);
  return rest === "" || rest === "/" ? fallback : rest;
}

/**
 * Résout la zone (public/privé) et le chemin interne à partir de l'hôte et
 * du chemin de la requête. En dev (localhost), la zone est portée par un
 * préfixe de chemin ; en production, par le sous-domaine. Agnostique de la
 * plateforme d'hébergement — ne dépend d'aucune API propriétaire.
 */
export function resolveZone(hostname: string, pathname: string): ZoneResolution {
  const host = hostname.split(":")[0].toLowerCase();

  if (isLocalHost(host)) {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return { zone: "dashboard", rewrittenPathname: stripPrefix(pathname, "/admin", "/pos") };
    }
    if (pathname === "/platform" || pathname.startsWith("/platform/")) {
      return { zone: "admin", rewrittenPathname: stripPrefix(pathname, "/platform", "/boutiques") };
    }
    return { zone: "storefront", rewrittenPathname: pathname };
  }

  if (host.startsWith(ADMIN_HOST_PREFIX)) {
    return { zone: "dashboard", rewrittenPathname: pathname };
  }
  if (host.startsWith(PLATFORM_HOST_PREFIX)) {
    return { zone: "admin", rewrittenPathname: pathname };
  }
  return { zone: "storefront", rewrittenPathname: pathname };
}

export function isPathAllowedForZone(zone: Zone, pathname: string): boolean {
  const isDashboardPath = DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (zone === "dashboard") return isDashboardPath;
  if (zone === "admin") return isAdminPath;
  return !isDashboardPath && !isAdminPath;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/proxy/zones.test.ts`
Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/proxy
git commit -m "feat: add pure zone resolution for host- and path-based routing"
```

---

### Task 8: Next.js `proxy.ts` — wire zones, tenant, and the auth guard

**Files:**
- Create: `proxy.ts` (repository root)

**Interfaces:**
- Consumes: `resolveZone`, `isPathAllowedForZone` (Task 7); `resolveTenantFromHost` (Task 5); `requireZone` (Task 6).
- Produces: the live Next.js request-time zone/tenant/auth wiring. Nothing downstream in this plan imports `proxy.ts` (it's the framework entry point) — Plan 2's storefront pages benefit from it being in place (the `x-tenant-id` header it sets is what `getCurrentTenant()` reads).

This file is framework glue (thin by design, per the architecture note) and is **not unit-tested** — it's verified manually against the running dev server in Step 3 below, since it needs real `NextRequest`/host resolution that a Node-only Vitest run can't exercise meaningfully.

- [ ] **Step 1: Implement**

Create `proxy.ts` at the repository root:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveZone, isPathAllowedForZone } from "@/lib/proxy/zones";
import { resolveTenantFromHost } from "@/lib/tenant/registry";
import { requireZone } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "localhost";
  const { zone, rewrittenPathname } = resolveZone(hostname, request.nextUrl.pathname);

  if (!isPathAllowedForZone(zone, rewrittenPathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (zone !== "storefront" && !requireZone(zone).allowed) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const tenant = resolveTenantFromHost(hostname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);

  const url = request.nextUrl.clone();
  url.pathname = rewrittenPathname;

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manually verify against the dev server**

Run: `npm run dev` (leave it running), then in another terminal:

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3000/pos
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/pos
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: admin.localhost:3000" http://localhost:3000/pos
```

Expected:
- `GET /pos` on the plain dev host → redirected to `/` (storefront zone rejects a dashboard-only path) — first line shows a `307`/`308` with `redirect_url` ending in `/`.
- `GET /admin/pos` → `200` (dev path-prefix reaches the existing POS screen through the rewrite).
- `GET /pos` with `Host: admin.localhost:3000` → `200` (prod-style host resolution reaches the same screen without a path prefix).

Stop the dev server (`Ctrl+C`) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add proxy.ts
git commit -m "feat: add proxy.ts wiring zone resolution, tenant headers, and the auth guard"
```

---

### Task 9: Shared order + stock engine (`useShop`)

**Files:**
- Create: `lib/store/shopLogic.ts`
- Create: `lib/store/shopLogic.test.ts`
- Create: `lib/store/useShop.ts`

**Interfaces:**
- Consumes: `catalog` (Task 3), `Order`/`OrderLine`/`OrderStatus` (Task 2), `KycInput` (Task 4), `DEFAULT_TENANT` (Task 5), `fmt`/`money` from `lib/format.ts` (existing).
- Produces:
  - Pure (`shopLogic.ts`): `WebCartLine`, `computeEffectiveStatus(order, overrides)`, `countPending(orders, overrides)`, `computeEffectiveStock(productId, deductions)`, `buildWebOrder(kyc, cartLines, ref)`, `applyConfirmDeductions(deductions, order)`.
  - Store (`useShop.ts`): Zustand hook `useShop` exposing state `{ orders, statusOverrides, stockDeductions, autoValidate }` and actions `{ effectiveStatus(orderId), effectiveStock(productId), pendingCount(), submitWebOrder(kyc, cartLines), confirmOrder(orderId), rejectOrder(orderId), setOrderStatus(orderId, status), toggleAuto() }`.
  - Consumed by: Task 12 (`OrdersScreen`, `useNewOrdersCount`), Task 13 (`InventoryScreen`), and by Plan 2's checkout/product/confirmation views.

- [ ] **Step 1: Write the failing tests for the pure logic**

Create `lib/store/shopLogic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeEffectiveStatus,
  countPending,
  computeEffectiveStock,
  buildWebOrder,
  applyConfirmDeductions,
} from "@/lib/store/shopLogic";
import { orders } from "@/lib/data/orders";
import type { Order } from "@/lib/data/types";

describe("computeEffectiveStatus", () => {
  it("returns the order's own status with no override", () => {
    const order = orders.find((o) => o.id === "#TER-0492")!;
    expect(computeEffectiveStatus(order, {})).toBe("nouvelle");
  });

  it("returns the override when present", () => {
    const order = orders.find((o) => o.id === "#TER-0492")!;
    expect(computeEffectiveStatus(order, { [order.id]: "confirmee" })).toBe("confirmee");
  });
});

describe("countPending", () => {
  it("counts only orders whose effective status is nouvelle", () => {
    // seed data: #TER-0492, #TER-0491, #TER-0490 are "nouvelle"; the rest are not.
    expect(countPending(orders, {})).toBe(3);
  });

  it("respects overrides when counting", () => {
    expect(countPending(orders, { "#TER-0492": "confirmee" })).toBe(2);
  });
});

describe("computeEffectiveStock", () => {
  it("returns the base stock with no deduction", () => {
    expect(computeEffectiveStock("p1", {})).toBe(24);
  });

  it("subtracts a recorded deduction", () => {
    expect(computeEffectiveStock("p1", { p1: 10 })).toBe(14);
  });

  it("clamps at zero if the deduction exceeds stock", () => {
    expect(computeEffectiveStock("p1", { p1: 999 })).toBe(0);
  });

  it("returns 0 for an unknown product id", () => {
    expect(computeEffectiveStock("nope", {})).toBe(0);
  });
});

describe("buildWebOrder", () => {
  const kyc = { name: "Awa Diallo", place: "Paris, France", phone: "+33 6 12 34 56 78", note: "", wa: true };
  const cartLines = [
    { productId: "p1", name: "Foulard Wax Abidjan", variant: "Indigo", price: 12500, qty: 2 },
    { productId: "p9", name: "Broche dorée", variant: "Standard", price: 4500, qty: 1 },
  ];

  it("builds a pending Web order with a recomputed total", () => {
    const order = buildWebOrder(kyc, cartLines, "#TER-2701");
    expect(order.id).toBe("#TER-2701");
    expect(order.status).toBe("nouvelle");
    expect(order.channel).toBe("Web");
    expect(order.items).toBe(3);
    // Normalise l'espace (fmt() produit une espace fine insécable U+202F) avant comparaison.
    expect(order.total.replace(/\s/g, " ")).toBe("29 500 FCFA"); // 2*12500 + 1*4500 = 29500
  });

  it("carries the customer's own place/phone verbatim (no hardcoded country)", () => {
    const order = buildWebOrder(kyc, cartLines, "#TER-2702");
    expect(order.place).toBe("Paris, France");
    expect(order.phone).toBe("+33 6 12 34 56 78");
  });

  it("carries productId on every line for later stock deduction", () => {
    const order = buildWebOrder(kyc, cartLines, "#TER-2703");
    expect(order.lines.map((l) => l.productId)).toEqual(["p1", "p9"]);
  });
});

describe("applyConfirmDeductions", () => {
  const order: Order = {
    id: "#TER-9001", cid: "web", client: "Test", place: "Test", phone: "000",
    items: 3, channel: "Web", ago: "", date: "", total: "0 FCFA", status: "nouvelle", vip: false,
    lines: [
      { name: "A", qty: 2, price: "0", total: "0", productId: "p1" },
      { name: "B", qty: 1, price: "0", total: "0", productId: "p9" },
    ],
  };

  it("adds line quantities to the deduction map", () => {
    const result = applyConfirmDeductions({}, order);
    expect(result).toEqual({ p1: 2, p9: 1 });
  });

  it("accumulates on top of an existing deduction for the same product", () => {
    const result = applyConfirmDeductions({ p1: 5 }, order);
    expect(result.p1).toBe(7);
  });

  it("does not mutate other products' deductions", () => {
    const result = applyConfirmDeductions({ p3: 4 }, order);
    expect(result.p3).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/store/shopLogic.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the pure logic**

Create `lib/store/shopLogic.ts`:

```ts
import { catalog } from "@/lib/data/catalog";
import { fmt, money } from "@/lib/format";
import type { Order, OrderLine, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";

export interface WebCartLine {
  productId: string;
  name: string;
  variant: string;
  price: number;
  qty: number;
}

/** Statut effectif = surcharge locale (validation/refus) sinon statut d'origine. */
export function computeEffectiveStatus(order: Order, overrides: Record<string, OrderStatus>): OrderStatus {
  return overrides[order.id] ?? order.status;
}

export function countPending(orders: Order[], overrides: Record<string, OrderStatus>): number {
  return orders.filter((o) => computeEffectiveStatus(o, overrides) === "nouvelle").length;
}

/** Stock effectif = stock de base moins les déductions déjà appliquées (jamais négatif). */
export function computeEffectiveStock(productId: string, deductions: Record<string, number>): number {
  const product = catalog.find((p) => p.id === productId);
  if (!product) return 0;
  const deducted = deductions[productId] ?? 0;
  return Math.max(0, product.stock - deducted);
}

/** Construit une commande Web en attente. Le total est recalculé ici — jamais reçu du client. */
export function buildWebOrder(kyc: KycInput, cartLines: WebCartLine[], ref: string): Order {
  const subtotal = cartLines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const itemCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const lines: OrderLine[] = cartLines.map((l) => ({
    name: l.name,
    qty: l.qty,
    price: fmt(l.price),
    total: fmt(l.price * l.qty),
    productId: l.productId,
  }));

  return {
    id: ref,
    cid: "web",
    client: kyc.name,
    place: kyc.place,
    phone: kyc.phone,
    items: itemCount,
    channel: "Web",
    ago: "à l'instant",
    date: "Aujourd'hui",
    total: money(subtotal),
    status: "nouvelle",
    vip: false,
    lines,
  };
}

/** Ajoute les quantités d'une commande confirmée aux déductions de stock existantes. */
export function applyConfirmDeductions(
  deductions: Record<string, number>,
  order: Order
): Record<string, number> {
  const next = { ...deductions };
  for (const line of order.lines) {
    next[line.productId] = (next[line.productId] ?? 0) + line.qty;
  }
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/store/shopLogic.test.ts`
Expected: all tests PASS (14 total across the suites).

- [ ] **Step 5: Wire the Zustand store**

Create `lib/store/useShop.ts`:

```ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { orders as seedOrders } from "@/lib/data/orders";
import type { Order, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import {
  applyConfirmDeductions,
  buildWebOrder,
  computeEffectiveStatus,
  computeEffectiveStock,
  countPending,
  type WebCartLine,
} from "./shopLogic";

export type { WebCartLine } from "./shopLogic";

interface ShopState {
  orders: Order[];
  statusOverrides: Record<string, OrderStatus>;
  stockDeductions: Record<string, number>;
  autoValidate: boolean;

  effectiveStatus: (orderId: string) => OrderStatus;
  effectiveStock: (productId: string) => number;
  pendingCount: () => number;

  submitWebOrder: (kyc: KycInput, cartLines: WebCartLine[]) => Order;
  confirmOrder: (orderId: string) => void;
  rejectOrder: (orderId: string) => void;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
  toggleAuto: () => void;
}

let refCounter = 2700;
function nextOrderRef(): string {
  refCounter += 1;
  return `#TER-${refCounter}`;
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      orders: seedOrders,
      statusOverrides: {},
      stockDeductions: {},
      autoValidate: false,

      effectiveStatus: (orderId) => {
        const s = get();
        const order = s.orders.find((o) => o.id === orderId);
        return order ? computeEffectiveStatus(order, s.statusOverrides) : "nouvelle";
      },

      effectiveStock: (productId) => computeEffectiveStock(productId, get().stockDeductions),

      pendingCount: () => countPending(get().orders, get().statusOverrides),

      submitWebOrder: (kyc, cartLines) => {
        const order = buildWebOrder(kyc, cartLines, nextOrderRef());
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      confirmOrder: (orderId) => {
        const s = get();
        if (s.effectiveStatus(orderId) !== "nouvelle") return; // idempotent — stock is deducted once
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return;
        set({
          statusOverrides: { ...s.statusOverrides, [orderId]: "confirmee" },
          stockDeductions: applyConfirmDeductions(s.stockDeductions, order),
        });
      },

      rejectOrder: (orderId) => {
        set((s) => ({ statusOverrides: { ...s.statusOverrides, [orderId]: "refusee" } }));
      },

      setOrderStatus: (orderId, status) => {
        set((s) => ({ statusOverrides: { ...s.statusOverrides, [orderId]: status } }));
      },

      toggleAuto: () => set((s) => ({ autoValidate: !s.autoValidate })),
    }),
    {
      name: `ft-shop-store-${DEFAULT_TENANT.id}`,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        orders: s.orders,
        statusOverrides: s.statusOverrides,
        stockDeductions: s.stockDeductions,
        autoValidate: s.autoValidate,
      }),
    }
  )
);
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors (existing `useBackoffice.ts`/`OrdersScreen.tsx` still compile as-is — they aren't touched until Task 12).

- [ ] **Step 7: Commit**

```bash
git add lib/store/shopLogic.ts lib/store/shopLogic.test.ts lib/store/useShop.ts
git commit -m "feat: add shared order/stock engine (useShop) with pure, tested logic"
```

---

### Task 10: Storefront cart + UI store (`useStorefront`)

**Files:**
- Create: `lib/store/cartLogic.ts`
- Create: `lib/store/cartLogic.test.ts`
- Create: `lib/store/useStorefront.ts`

**Interfaces:**
- Consumes: `DEFAULT_TENANT` (Task 5).
- Produces:
  - Pure (`cartLogic.ts`): `StoreCartLine`, `cartKey(productId, variant)`, `addLine(cart, line)`, `incLine(cart, key, delta)`, `removeLine(cart, key)`, `cartSubtotal(cart)`, `cartCount(cart)`.
  - Store (`useStorefront.ts`): Zustand hook `useStorefront` exposing `{ cart, offline, toast, menuOpen, blocksMode, blockOrder, blockHidden, blockNames, kyc, kycTouched, sending }` and actions `{ addToCart, incLine, rmLine, clearCart, toggleOffline, showToast, openMenu, closeMenu, toggleBlocksMode, moveBlock, toggleHideBlock, renameBlock, setKycField, markKycTouched, setSending, resetKyc }`. Also exports `BlockId`, `DEFAULT_BLOCK_ORDER`, `DEFAULT_BLOCK_NAMES`, `KycForm`.
  - Consumed by: Plan 2's entire storefront UI (chrome, blocks, cart/checkout views). Nothing in this plan consumes it directly, but Task 11's hydration bootstrap references it.

- [ ] **Step 1: Write the failing tests**

Create `lib/store/cartLogic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cartKey, addLine, incLine, removeLine, cartSubtotal, cartCount } from "@/lib/store/cartLogic";
import type { StoreCartLine } from "@/lib/store/cartLogic";

const scarf = { productId: "p1", name: "Foulard Wax Abidjan", variant: "Indigo", colorHex: "#26326B", price: 12500 };

describe("cartKey", () => {
  it("combines productId and variant", () => {
    expect(cartKey("p1", "Indigo")).toBe("p1|Indigo");
  });
});

describe("addLine", () => {
  it("adds a new line with qty 1 by default", () => {
    const cart = addLine([], scarf);
    expect(cart).toEqual([{ ...scarf, key: "p1|Indigo", qty: 1 }]);
  });

  it("merges quantity when the same product+variant is added again", () => {
    let cart: StoreCartLine[] = [];
    cart = addLine(cart, scarf);
    cart = addLine(cart, scarf);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it("keeps separate lines for different variants of the same product", () => {
    let cart: StoreCartLine[] = [];
    cart = addLine(cart, scarf);
    cart = addLine(cart, { ...scarf, variant: "Terracotta", colorHex: "#D07A34" });
    expect(cart).toHaveLength(2);
  });

  it("accepts an explicit qty", () => {
    const cart = addLine([], { ...scarf, qty: 3 });
    expect(cart[0].qty).toBe(3);
  });
});

describe("incLine", () => {
  it("increments the matching line", () => {
    const cart = addLine([], scarf);
    const result = incLine(cart, "p1|Indigo", 1);
    expect(result[0].qty).toBe(2);
  });

  it("removes the line once qty reaches zero", () => {
    const cart = addLine([], scarf);
    const result = incLine(cart, "p1|Indigo", -1);
    expect(result).toHaveLength(0);
  });
});

describe("removeLine", () => {
  it("removes the line by key", () => {
    const cart = addLine([], scarf);
    expect(removeLine(cart, "p1|Indigo")).toHaveLength(0);
  });
});

describe("cartSubtotal / cartCount", () => {
  it("sums price*qty and total quantity across lines", () => {
    let cart: StoreCartLine[] = [];
    cart = addLine(cart, { ...scarf, qty: 2 });
    cart = addLine(cart, { productId: "p9", name: "Broche dorée", variant: "Standard", colorHex: "#C9A227", price: 4500, qty: 1 });
    expect(cartSubtotal(cart)).toBe(29500);
    expect(cartCount(cart)).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/store/cartLogic.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the pure cart logic**

Create `lib/store/cartLogic.ts`:

```ts
export interface StoreCartLine {
  key: string;
  productId: string;
  name: string;
  variant: string;
  colorHex: string;
  price: number;
  qty: number;
}

export function cartKey(productId: string, variant: string): string {
  return `${productId}|${variant}`;
}

export function addLine(
  cart: StoreCartLine[],
  line: Omit<StoreCartLine, "qty" | "key"> & { qty?: number }
): StoreCartLine[] {
  const key = cartKey(line.productId, line.variant);
  const qty = line.qty ?? 1;
  const existing = cart.find((l) => l.key === key);
  if (existing) {
    return cart.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
  }
  return [...cart, { ...line, key, qty }];
}

export function incLine(cart: StoreCartLine[], key: string, delta: number): StoreCartLine[] {
  return cart
    .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
    .filter((l) => l.qty > 0);
}

export function removeLine(cart: StoreCartLine[], key: string): StoreCartLine[] {
  return cart.filter((l) => l.key !== key);
}

export function cartSubtotal(cart: StoreCartLine[]): number {
  return cart.reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function cartCount(cart: StoreCartLine[]): number {
  return cart.reduce((sum, l) => sum + l.qty, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/store/cartLogic.test.ts`
Expected: all 9 tests PASS.

- [ ] **Step 5: Wire the Zustand store**

Create `lib/store/useStorefront.ts`:

```ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import { addLine, incLine as incLineLogic, removeLine, type StoreCartLine } from "./cartLogic";

export type { StoreCartLine } from "./cartLogic";

export type ToastType = "success" | "warning" | "error";

export type BlockId =
  | "hero"
  | "cats"
  | "grid"
  | "loyalty"
  | "featured"
  | "story"
  | "look"
  | "news"
  | "contact";

export const DEFAULT_BLOCK_ORDER: BlockId[] = [
  "hero", "cats", "grid", "loyalty", "featured", "story", "look", "news", "contact",
];

export const DEFAULT_BLOCK_NAMES: Record<BlockId, string> = {
  hero: "Bandeau Hero",
  cats: "Vignettes catégories",
  grid: "Nouveautés & best-sellers",
  loyalty: "Bandeau fidélité",
  featured: "Produit vedette",
  story: "Notre histoire",
  look: "Galerie / Lookbook",
  news: "Newsletter",
  contact: "Contact & localisation",
};

export interface KycForm {
  name: string;
  place: string;
  phone: string;
  note: string;
  wa: boolean;
}

const EMPTY_KYC: KycForm = { name: "", place: "", phone: "", note: "", wa: true };

interface StorefrontState {
  cart: StoreCartLine[];
  offline: boolean;
  toast: { msg: string; type: ToastType } | null;
  menuOpen: boolean;

  blocksMode: boolean;
  blockOrder: BlockId[];
  blockHidden: Partial<Record<BlockId, boolean>>;
  blockNames: Record<BlockId, string>;

  kyc: KycForm;
  kycTouched: boolean;
  sending: boolean;

  addToCart: (line: Omit<StoreCartLine, "qty" | "key"> & { qty?: number }) => void;
  incLine: (key: string, delta: number) => void;
  rmLine: (key: string) => void;
  clearCart: () => void;

  toggleOffline: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  openMenu: () => void;
  closeMenu: () => void;

  toggleBlocksMode: () => void;
  moveBlock: (id: BlockId, dir: -1 | 1) => void;
  toggleHideBlock: (id: BlockId) => void;
  renameBlock: (id: BlockId, name: string) => void;

  setKycField: (field: keyof KycForm, value: string | boolean) => void;
  markKycTouched: () => void;
  setSending: (sending: boolean) => void;
  resetKyc: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStorefront = create<StorefrontState>()(
  persist(
    (set, get) => ({
      cart: [],
      offline: false,
      toast: null,
      menuOpen: false,

      blocksMode: false,
      blockOrder: DEFAULT_BLOCK_ORDER,
      blockHidden: {},
      blockNames: DEFAULT_BLOCK_NAMES,

      kyc: EMPTY_KYC,
      kycTouched: false,
      sending: false,

      addToCart: (line) => set((s) => ({ cart: addLine(s.cart, line) })),
      incLine: (key, delta) => set((s) => ({ cart: incLineLogic(s.cart, key, delta) })),
      rmLine: (key) => set((s) => ({ cart: removeLine(s.cart, key) })),
      clearCart: () => set({ cart: [] }),

      toggleOffline: () =>
        set((s) => {
          const next = !s.offline;
          get().showToast(next ? "Mode hors-ligne simulé" : "De retour en ligne", next ? "warning" : "success");
          return { offline: next };
        }),

      showToast: (msg, type = "success") => {
        set({ toast: { msg, type } });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null }), 2400);
      },

      openMenu: () => set({ menuOpen: true }),
      closeMenu: () => set({ menuOpen: false }),

      toggleBlocksMode: () => set((s) => ({ blocksMode: !s.blocksMode })),

      moveBlock: (id, dir) =>
        set((s) => {
          const order = [...s.blockOrder];
          const i = order.indexOf(id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= order.length) return {};
          [order[i], order[j]] = [order[j], order[i]];
          return { blockOrder: order };
        }),

      toggleHideBlock: (id) => set((s) => ({ blockHidden: { ...s.blockHidden, [id]: !s.blockHidden[id] } })),

      renameBlock: (id, name) => set((s) => ({ blockNames: { ...s.blockNames, [id]: name } })),

      setKycField: (field, value) => set((s) => ({ kyc: { ...s.kyc, [field]: value } })),
      markKycTouched: () => set({ kycTouched: true }),
      setSending: (sending) => set({ sending }),
      resetKyc: () => set({ kyc: EMPTY_KYC, kycTouched: false }),
    }),
    {
      name: `ft-storefront-store-${DEFAULT_TENANT.id}`,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        cart: s.cart,
        blockOrder: s.blockOrder,
        blockHidden: s.blockHidden,
        blockNames: s.blockNames,
      }),
    }
  )
);
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/store/cartLogic.ts lib/store/cartLogic.test.ts lib/store/useStorefront.ts
git commit -m "feat: add storefront cart and UI store (useStorefront) with pure, tested cart logic"
```

---

### Task 11: SSR-safe hydration bootstrap

**Files:**
- Create: `components/HydrateStores.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `useShop` (Task 9), `useStorefront` (Task 10).
- Produces: a mounted, client-only component that calls `.persist.rehydrate()` once, resolving the SSR/localStorage mismatch risk flagged in the spec (§13). No other task depends on this directly, but every screen reading `useShop`/`useStorefront` needs it mounted to see persisted data after a reload.

- [ ] **Step 1: Implement the bootstrap component**

Create `components/HydrateStores.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";

/**
 * Both `useShop` and `useStorefront` use `persist({ skipHydration: true })` so
 * the server-rendered markup never depends on localStorage. This component
 * triggers the one-time client rehydration after mount, per Zustand's
 * documented SSR pattern.
 */
export function HydrateStores() {
  useEffect(() => {
    useShop.persist.rehydrate();
    useStorefront.persist.rehydrate();
  }, []);

  return null;
}
```

- [ ] **Step 2: Mount it in the root layout**

Modify `app/layout.tsx` — add the import and mount `<HydrateStores />` as the first child of `<body>`:

```tsx
import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { HydrateStores } from "@/components/HydrateStores";
```

And change the `<body>` line:

```tsx
      <body>
        <HydrateStores />
        {children}
      </body>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify no hydration warnings**

Run: `npm run dev`, open `http://localhost:3000/admin/pos` in a browser, open the browser console.
Expected: no React hydration mismatch warnings printed. Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add components/HydrateStores.tsx app/layout.tsx
git commit -m "feat: add SSR-safe rehydration bootstrap for shared stores"
```

---

### Task 12: Migrate order status/validation from `useBackoffice` to `useShop`

**Files:**
- Modify: `lib/store/useNewOrdersCount.ts`
- Modify: `lib/store/useBackoffice.ts`
- Modify: `components/dashboard/screens/OrdersScreen.tsx`

**Interfaces:**
- Consumes: `useShop` (Task 9).
- Produces: the back-office's order badge/list/validate/refuse flow now reads and writes through the shared engine — this is the seam Plan 2's checkout view plugs into (a web order submitted there will show up here).

- [ ] **Step 1: Update the new-orders badge counter**

Replace `lib/store/useNewOrdersCount.ts` in full:

```ts
import { useShop } from "./useShop";

/** Nombre de commandes encore « à valider », en tenant compte des surcharges. */
export function useNewOrdersCount(): number {
  return useShop((s) => s.pendingCount());
}
```

- [ ] **Step 2: Remove order-status state from `useBackoffice`**

In `lib/store/useBackoffice.ts`:

Change the import line:

```ts
import type { Customer, Product } from "@/lib/data/types";
```

(drops the now-unused `OrderStatus` import).

Remove these two lines from the `BackofficeState` interface:

```ts
  // Commandes — surcharges de statut (persistées entre écrans)
  orderStatus: Record<string, OrderStatus>;
  autoValidate: boolean;
```

Remove these two lines from the interface's actions section:

```ts
  setOrderStatus: (id: string, status: OrderStatus) => void;
  toggleAuto: () => void;
```

Remove these two lines from the store body:

```ts
  orderStatus: {},
  autoValidate: false,
```

Remove these lines from the store body:

```ts
  setOrderStatus: (id, status) =>
    set((s) => ({ orderStatus: { ...s.orderStatus, [id]: status } })),
  toggleAuto: () => set((s) => ({ autoValidate: !s.autoValidate })),
```

- [ ] **Step 3: Typecheck (expected to fail — `OrdersScreen.tsx` still references the removed state)**

Run: `npm run typecheck`
Expected: errors in `components/dashboard/screens/OrdersScreen.tsx` referencing `s.orderStatus`, `s.autoValidate`, `s.toggleAuto`, `s.setOrderStatus`. This confirms the removal took effect; the next step fixes the consumer.

- [ ] **Step 4: Update `OrdersScreen.tsx` to read/act via `useShop`**

In `components/dashboard/screens/OrdersScreen.tsx`, change the import block:

```tsx
import { statusMeta } from "@/lib/data/orderStatus";
import { computeEffectiveStatus } from "@/lib/store/shopLogic";
import { initials } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { useShop } from "@/lib/store/useShop";
```

(replaces the old `import { orders } from "@/lib/data/orders";` and `import { effStatus, statusMeta } from "@/lib/data/orderStatus";` — `orders` now comes from the store, not the static file, and `effStatus` is replaced by `computeEffectiveStatus`).

Change the top of the component body:

```tsx
  const orders = useShop((s) => s.orders);
  const overrides = useShop((s) => s.statusOverrides);
  const autoValidate = useShop((s) => s.autoValidate);
  const toggleAuto = useShop((s) => s.toggleAuto);
  const confirmOrder = useShop((s) => s.confirmOrder);
  const rejectOrder = useShop((s) => s.rejectOrder);
  const showToast = useBackoffice((s) => s.showToast);
```

Everywhere the file called `effStatus(o, overrides)` or `effStatus(selected, overrides)`, replace with `computeEffectiveStatus(o, overrides)` / `computeEffectiveStatus(selected, overrides)` (three call sites: inside `list = orders.filter(...)`, inside `count = (st) => ...`, and the `status={computeEffectiveStatus(selected, overrides)}` prop passed to `<OrderDetail>`).

Change the `OrderDetail` callbacks:

```tsx
              onValidate={() => {
                confirmOrder(selected.id);
                showToast("Commande validée — stock déduit", "success");
              }}
              onRefuse={() => {
                rejectOrder(selected.id);
                showToast("Commande refusée", "error");
              }}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manually verify the validate/refuse flow**

Run: `npm run dev`, open `http://localhost:3000/admin/commandes`.
Expected:
- The "À valider" tab shows 3 orders (`#TER-0492`, `#TER-0491`, `#TER-0490`), matching the `countPending` test from Task 9.
- Selecting `#TER-0492` and clicking **Valider** moves it out of "À valider" into "Confirmées", shows the success toast, and the sidebar/mobile-nav badge count decreases by one.
- Reloading the page keeps the order confirmed (persisted via `useShop`).

Stop the dev server once confirmed.

- [ ] **Step 7: Commit**

```bash
git add lib/store/useNewOrdersCount.ts lib/store/useBackoffice.ts components/dashboard/screens/OrdersScreen.tsx
git commit -m "refactor: source order status and validation from the shared useShop engine"
```

---

### Task 13: Show effective (deducted) stock in Inventory

**Files:**
- Modify: `components/dashboard/screens/InventoryScreen.tsx`

**Interfaces:**
- Consumes: `useShop` (Task 9, specifically `effectiveStock`).
- Produces: the "Interne" stock column and the drawer's "Stock interne (boutique)" figure now reflect confirmed web-order deductions — the visible proof, in the existing back-office, that a validated online order really moved the stock.

- [ ] **Step 1: Add the import and hook read in the main screen**

In `components/dashboard/screens/InventoryScreen.tsx`, add to the imports:

```tsx
import { useShop } from "@/lib/store/useShop";
```

Inside `export function InventoryScreen()`, right after the existing `useState` calls, add:

```tsx
  const effectiveStock = useShop((s) => s.effectiveStock);
```

Replace this line inside the `rows.map((p, i) => { ... })` callback:

```tsx
                const s1 = p.stock;
```

with:

```tsx
                const s1 = effectiveStock(p.id);
```

- [ ] **Step 2: Apply the same read in the edit drawer**

In the `EditDrawer` function (same file), add the hook call at the top of the function body:

```tsx
function EditDrawer({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const effectiveStock = useShop((s) => s.effectiveStock);
  const s1 = effectiveStock(p.id);
```

(replaces the existing `const s1 = p.stock;` line in that function).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify the deduction shows up**

Run: `npm run dev`. In `http://localhost:3000/admin/commandes`, validate order `#TER-0492` (lines: 1× p2, 1× p3, 2× p9) if not already validated in Task 12's check. Then open `http://localhost:3000/admin/inventaire`.
Expected: the "Interne" column for **Foulard soie Kente** (p2) reads `5` (was 6), **Turban Bazin Or** (p3) reads `13` (was 14), **Broche dorée** (p9) reads `20` (was 22). Opening the drawer for any of these three shows the same reduced figure under "Stock interne (boutique)".

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/screens/InventoryScreen.tsx
git commit -m "feat: display effective stock (post-deduction) in the inventory screen"
```

---

### Task 14: Break the zone redirect loop at `/` + admin zone placeholder

**Files:**
- Modify: `app/page.tsx`
- Create: `app/(admin)/boutiques/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a working root route under the `storefront` zone, and a real page for the `admin` zone's only allowed path (`/boutiques`), so the full zone matrix from Task 7/8 can be exercised end-to-end without any dangling or looping route.

This task exists because of a real bug the zone model introduces: `app/page.tsx` currently does `redirect("/pos")`. Under the new proxy (Task 8), `/pos` is only reachable in the `dashboard` zone (i.e. via `/admin/pos` in dev, or the `admin.` host in prod). On the plain storefront host, hitting `/` would redirect to `/pos`, which the zone guard would then redirect back to `/` — an infinite loop. `/` must stop redirecting into the dashboard.

- [ ] **Step 1: Replace the root page with a storefront placeholder**

Replace `app/page.tsx` in full:

```tsx
export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, margin: "0 0 8px" }}>
          Foulard Teranga
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: 15, lineHeight: 1.5 }}>
          La vitrine arrive bientôt. En attendant, l&apos;équipe accède au back-office via{" "}
          <code>/admin</code>.
        </p>
      </div>
    </main>
  );
}
```

This is a deliberately minimal placeholder — Plan 2 replaces it with the real blocks-driven Home. Its only job here is to give the `storefront` zone a real, non-redirecting page at `/`.

- [ ] **Step 2: Add the admin-zone placeholder page**

Create `app/(admin)/boutiques/page.tsx`:

```tsx
export default function BoutiquesPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>Boutiques</h1>
      <p style={{ color: "var(--color-muted)" }}>
        Espace prestataire / super-admin — v1 mono-boutique. Une seule boutique (Foulard Teranga)
        est listée ici ; cet écran grandit au passage multi-boutique.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manually verify the full zone matrix, including the loop fix**

Run: `npm run dev`, then in another terminal:

```bash
curl -s -o /dev/null -w "/ (storefront):        %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "/admin/pos (dashboard): %{http_code}\n" http://localhost:3000/admin/pos
curl -s -o /dev/null -w "/platform/boutiques (admin): %{http_code}\n" http://localhost:3000/platform/boutiques
curl -s -o /dev/null -w "/pos (no prefix):       %{http_code} -> %{redirect_url}\n" http://localhost:3000/pos
curl -sIL http://localhost:3000/ | grep -i "^HTTP" # follow any redirects from / — must not loop
```

Expected:
- `/` → `200` (placeholder storefront page, no redirect).
- `/admin/pos` → `200`.
- `/platform/boutiques` → `200`.
- `/pos` (no prefix) → non-2xx status with `redirect_url` ending in `/`.
- The last command (`curl -sIL`, follows redirects) prints exactly one `HTTP/... 200` line for `/` — confirming no loop.

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx "app/(admin)/boutiques/page.tsx"
git commit -m "fix: replace root dashboard redirect with a storefront placeholder to prevent a zone redirect loop"
```

---

## Plan-wide Verification

- [ ] **Full test suite**

Run: `npm run test`
Expected: all suites across `lib/format.test.ts`, `lib/data/catalog.test.ts`, `lib/validators/kyc.test.ts`, `lib/tenant/registry.test.ts`, `lib/auth/index.test.ts`, `lib/proxy/zones.test.ts`, `lib/store/shopLogic.test.ts`, `lib/store/cartLogic.test.ts` pass — 0 failures.

- [ ] **Full typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **End-to-end manual walkthrough of the migrated back-office**

Run: `npm run dev`, then:
1. Visit `http://localhost:3000/admin/tableau-de-bord` — loads without error, badge counts match `pendingCount()`.
2. Visit `http://localhost:3000/admin/commandes` — validate one more pending order, confirm its stock deduction appears in `/admin/inventaire`.
3. Refresh the browser — confirmed status and deducted stock persist (localStorage-backed).
4. Visit plain `http://localhost:3000/` — loads the storefront placeholder from Task 14, no redirect loop.
5. Visit plain `http://localhost:3000/pos` (no `/admin` prefix) — redirects to `/` and stops there (does not bounce back to `/pos`).

---

## Handoff to Plan 2

This plan intentionally stops before any storefront page or component exists. The next plan (`docs/superpowers/plans/<next-date>-storefront-ui.md`) builds `app/(storefront)/*`, `components/storefront/*` (chrome, blocks, views) directly on top of the interfaces locked here:

- `catalog`, `storefrontCategories`, `newestProducts`, `featuredProduct`, `relatedTo`, `filterCatalog`, `CatalogFilters` from `lib/data/catalog.ts`.
- `validateKyc`, `KycInput` from `lib/validators/kyc.ts`.
- `useShop` (`submitWebOrder`, `effectiveStock`, `effectiveStatus`) from `lib/store/useShop.ts`.
- `useStorefront` (`cart` actions, `blocksMode`/block editor actions, `kyc` form actions, `toast`, `offline`, `menuOpen`) from `lib/store/useStorefront.ts`.
- `getCurrentTenant()` from `lib/tenant/index.ts`.
- The zone/proxy wiring from Task 8, so `/` genuinely reaches the new storefront home once it exists.
- The `app/page.tsx` placeholder from Task 14 is what Plan 2 replaces with the real blocks-driven Home — Plan 2 should overwrite it entirely rather than build alongside it.
- `useStorefront`'s cart (`StoreCartLine[]`: `key`, `productId`, `name`, `variant`, `colorHex`, `price`, `qty`) is a different shape from `useShop.submitWebOrder`'s `WebCartLine[]` (`productId`, `name`, `variant`, `price`, `qty` — no `key`/`colorHex`). Plan 2's checkout view maps one to the other by dropping `key` and `colorHex` before calling `submitWebOrder`.
