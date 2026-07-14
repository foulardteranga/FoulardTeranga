# Catalogue & stock (sous-projet 3/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static mock array in `lib/data/catalog.ts` with server-side Prisma reads from the already-seeded `Product` table, with zero change to visible behavior beyond real data and one deliberate stock-consistency fix.

**Architecture:** Prisma Client (new `@prisma/adapter-pg` driver adapter, singleton in `lib/db/client.ts`) reads `Product` rows scoped to the current tenant (via the existing, currently-unused `getCurrentTenant()` helper). `lib/data/catalog.ts` exposes two new async functions (`getCatalog`, `getProductById`) plus its existing pure helpers reparameterized to take a `Product[]` argument instead of closing over a static constant. Every page that needs product data (`app/(storefront)/...`, `app/(dashboard)/...`) becomes (or gains) a thin async Server Component that fetches once and passes the result down as props to the existing Client Components, which keep 100% of their current interactivity unchanged.

**Tech Stack:** Next.js 16.2 (App Router, Server Components), Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`), Supabase Postgres, TypeScript strict, Vitest, Zustand (unchanged).

## Global Constraints

- TypeScript `strict`, never `any` (CLAUDE.md §8).
- Server Components by default; `"use client"` only where interactivity requires it (CLAUDE.md §8) — new page-level fetches must be Server Components.
- Data access server-side only; no `service_role` key, no privileged query from the client (CLAUDE.md §9).
- **Read-only sub-project**: no product/stock write path (create, edit, adjust) — confirmed scope decision, spec §2.
- **No explicit cache** (`use cache`/Cache Components) for this sub-project — confirmed scope decision, spec §2.
- `npm run test` and `npm run typecheck` must stay green after every task.
- Turbopack panics on this checkout's parent directory name (NFD-decomposed accent) — use `next dev --webpack` / `next build --webpack` for any live verification (already configured as the `dev` server in `.claude/launch.json`), per `docs/superpowers/EXECUTION-STATUS.md`.
- Commits: Conventional Commits style, English, matching existing history (`feat:`, `refactor:`, `chore:`, `fix:`).
- Spec: `docs/superpowers/specs/2026-07-13-catalog-stock-design.md` — read it if any task instruction below seems to conflict with it; this plan implements it in full.

**On typecheck between Task 3 and Task 8:** `lib/data/catalog.ts`'s pure functions (`newestProducts`, `featuredProduct`, `relatedTo`, `filterCatalog`) and its `catalog` constant, plus `shopLogic.ts`'s `computeEffectiveStock`, are each consumed by several files that get migrated one page/task at a time (Tasks 5-9). This is a deliberate, bounded exception to "always green": `npm run typecheck` will show errors in **not-yet-migrated** consumer files between Task 3 and Task 9 — each task's own "Verify" step says exactly which files must be clean at that point. `npm run test` is unaffected throughout (Vitest transpiles but does not type-check, and no test imports the not-yet-migrated UI files), so it stays green after every single task. Task 9 is the first point where the whole project typechecks clean again; Task 10 confirms it end to end. Do not attempt to "fix" the expected intermediate typecheck errors in an earlier task — they resolve themselves as later tasks land.

---

### Task 1: Prisma driver adapter + singleton client

**Files:**
- Modify: `package.json` (add `@prisma/adapter-pg` dependency)
- Create: `lib/db/client.ts`

**Interfaces:**
- Consumes: `PrismaClient` from `@/lib/generated/prisma` (already generated, unchanged schema), `process.env.DATABASE_URL`.
- Produces: `export const prisma: PrismaClient` — the singleton every later task imports from `@/lib/db/client`.

- [ ] **Step 1: Install the driver adapter**

Prisma 7's `prisma-client` generator (already configured in `prisma/schema.prisma`) requires a driver adapter or it throws `PrismaClientInitializationError` (code `P2038`) at runtime — confirmed via Context7 docs for `/prisma/prisma/7.6.0`.

Run: `npm install @prisma/adapter-pg`
Expected: `package.json` gains `"@prisma/adapter-pg": "^7.x.x"` under `dependencies`, `package-lock.json` updated, no errors.

- [ ] **Step 2: Create the singleton client**

Create `lib/db/client.ts`:

```ts
import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

The `globalForPrisma` singleton survives Next.js dev-server Hot Module Reload without exhausting the Supabase pooler's connection pool — this is the canonical pattern for Prisma + Next.js (Context7, `/prisma/prisma/7.6.0`).

- [ ] **Step 3: Verify nothing broke**

Nothing imports this file yet, so this only proves it compiles standalone.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run test`
Expected: same test count and result as before this task (this file isn't imported anywhere yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/db/client.ts
git commit -m "chore: add Prisma pg driver adapter and a singleton PrismaClient"
```

---

### Task 2: Real Postgres credentials (user checkpoint)

**Files:**
- Modify: `.env` (not committed — gitignored)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a working `DATABASE_URL`/`DIRECT_URL` that every subsequent task's Prisma queries depend on to actually return data (though `npm run test`/`npm run typecheck` do not require it — see note in Task 3).

- [ ] **Step 1: STOP — ask the user for the real connection strings**

`.env` currently has:
```
DATABASE_URL="postgresql://postgres:***@localhost:5432/postgres"
DIRECT_URL="postgresql://postgres:***@localhost:5432/postgres"
```
These are placeholders from the DB-foundation sub-project — no code has ever connected with them. Ask the user to:
1. Open the Supabase dashboard for project `vqqwviknffequjvxmojo` → Project Settings → Database → Connection string.
2. Copy the **pooled** connection string (port 6543) into `DATABASE_URL`, appending `?pgbouncer=true` if not already present (matches `.env.example`'s documented shape).
3. Copy the **direct** connection string (port 5432) into `DIRECT_URL`.
4. Confirm here once `.env` is updated.

Do not proceed to Step 2 until the user confirms. Do not ask the user to paste the password into chat — they edit `.env` themselves, or tell you to do it once they've shared the values in a way they're comfortable with.

- [ ] **Step 2: Verify real connectivity**

Run: `npx prisma db pull --print`
Expected: prints the introspected live schema (6 models: `Tenant`, `Profile`, `Product`, `Customer`, `Order`, `OrderLine`, matching `prisma/schema.prisma`) without writing any file (`--print` only prints). A connection error here (`Can't reach database server`) means the credentials are still wrong — go back to Step 1.

- [ ] **Step 3: No commit**

`.env` is gitignored (`.gitignore` lines 25-26) — there is nothing to commit for this task. Proceed directly to Task 3.

---

### Task 3: `lib/data/catalog.ts` — Prisma reads + reparameterized pure functions

**Files:**
- Modify: `lib/data/catalog.ts`
- Modify: `lib/data/catalog.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/client` (Task 1), `getCurrentTenant()` from `@/lib/tenant` (already exists, unused until now), `Product` from `@/lib/generated/prisma` (Prisma-generated row type, aliased to avoid name clash).
- Produces:
  - `getCatalog(): Promise<Product[]>`
  - `getProductById(id: string): Promise<Product | null>`
  - `toProduct(row: PrismaProduct): Product`
  - `newestProducts(products: Product[], limit = 4): Product[]`
  - `featuredProduct(products: Product[]): Product | undefined`
  - `relatedTo(products: Product[], productId: string, limit = 4): Product[]`
  - `filterCatalog(products: Product[], filters: CatalogFilters): Product[]`
  - `categories`, `storefrontCategories`, `CatalogFilters` — unchanged.
  - The exported `catalog` constant array **no longer exists** — every later task's consumers must stop importing it.

- [ ] **Step 1: Update the test file first (will fail against the old implementation)**

Replace the full contents of `lib/data/catalog.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  categories,
  storefrontCategories,
  newestProducts,
  featuredProduct,
  relatedTo,
  filterCatalog,
  toProduct,
} from "@/lib/data/catalog";
import type { Product } from "@/lib/data/types";

const FIXTURE_PRODUCTS: Product[] = [
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

describe("catalog constants", () => {
  it("keeps Turbans in the full category list and in storefrontCategories", () => {
    expect(categories).toContain("Turbans");
    expect(storefrontCategories).toEqual(["Foulards", "Turbans", "Accessoires"]);
  });
});

describe("toProduct", () => {
  it("maps a Prisma row (category) to the app Product shape (cat)", () => {
    const row = {
      id: "p1", tenantId: "foulard-teranga", category: "Foulards" as const, name: "Foulard Wax Abidjan",
      variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "swatch", colors: ["#26326B"], motif: "Wax",
      lengths: ["90 × 90 cm"], description: "desc", oldPrice: null, badge: "Nouveau", featured: false,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const product = toProduct(row);
    expect(product.cat).toBe("Foulards");
    expect(product.oldPrice).toBeUndefined();
    expect(product.badge).toBe("Nouveau");
  });
});

describe("newestProducts", () => {
  it("returns badged products first, in catalog order", () => {
    expect(newestProducts(FIXTURE_PRODUCTS, 4).map((p) => p.id)).toEqual(["p1", "p2", "p7", "p10"]);
  });

  it("respects the limit", () => {
    expect(newestProducts(FIXTURE_PRODUCTS, 2).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("featuredProduct", () => {
  it("returns the product flagged featured", () => {
    expect(featuredProduct(FIXTURE_PRODUCTS)!.id).toBe("p2");
  });
});

describe("relatedTo", () => {
  it("returns same-category products excluding the product itself", () => {
    expect(relatedTo(FIXTURE_PRODUCTS, "p2").map((p) => p.id)).toEqual(["p1", "p4"]);
  });

  it("returns an empty array for an unknown id", () => {
    expect(relatedTo(FIXTURE_PRODUCTS, "nope")).toEqual([]);
  });
});

describe("filterCatalog", () => {
  const base = { cat: "Tous" as const, color: "", motif: "", priceMax: 999999, query: "", sort: "new" as const };

  it("returns everything with no filters", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, base)).toHaveLength(12);
  });

  it("filters by category", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, cat: "Turbans" }).map((p) => p.id)).toEqual(["p3"]);
  });

  it("filters by color (gold present on p3, absent on p4)", () => {
    const result = filterCatalog(FIXTURE_PRODUCTS, { ...base, color: "#C9A227" }).map((p) => p.id);
    expect(result).toContain("p3");
    expect(result).not.toContain("p4");
  });

  it("filters by motif", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, motif: "Kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("filters by max price inclusive", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, priceMax: 8000 }).map((p) => p.id)).toEqual(["p4", "p9", "p10", "p12"]);
  });

  it("filters by free-text query on name or motif", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, query: "kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("sorts ascending by price", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, cat: "Accessoires", sort: "asc" }).map((p) => p.id)).toEqual([
      "p9", "p10", "p12", "p11",
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run lib/data/catalog.test.ts`
Expected: FAIL — `newestProducts`/`featuredProduct`/`relatedTo`/`filterCatalog`/`toProduct` are called with a signature the current implementation doesn't have (TypeScript compile error surfaced as a Vitest failure, or wrong-arity runtime errors).

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `lib/data/catalog.ts`:

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { Product as PrismaProduct } from "@/lib/generated/prisma";
import type { Product, ProductCategory } from "./types";

export const categories: Array<"Tous" | ProductCategory> = [
  "Tous",
  "Foulards",
  "Turbans",
  "Tissus",
  "Accessoires",
];

/** Catégories mises en avant sur la Home (les Tissus restent filtrables au catalogue mais hors vignettes). */
export const storefrontCategories: ProductCategory[] = ["Foulards", "Turbans", "Accessoires"];

/** Convertit une ligne Prisma (colonne `category`) vers le type applicatif `Product` (champ `cat`). */
export function toProduct(row: PrismaProduct): Product {
  return {
    id: row.id,
    cat: row.category,
    name: row.name,
    variant: row.variant,
    price: row.price,
    stock: row.stock,
    swatch: row.swatch,
    colors: row.colors,
    motif: row.motif,
    lengths: row.lengths,
    description: row.description,
    oldPrice: row.oldPrice ?? undefined,
    badge: row.badge ?? undefined,
    featured: row.featured,
  };
}

/** Lit tout le catalogue du tenant courant depuis Postgres. */
export async function getCatalog(): Promise<Product[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toProduct);
}

/** Lit un seul produit par id, scopé au tenant courant. `null` si absent. */
export async function getProductById(id: string): Promise<Product | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
  });
  return row ? toProduct(row) : null;
}

/** Produits mis en avant sur la Home : les articles badgés d'abord, puis le reste, dans l'ordre du catalogue. */
export function newestProducts(products: Product[], limit = 4): Product[] {
  const badged = products.filter((p) => p.badge);
  const rest = products.filter((p) => !p.badge);
  return [...badged, ...rest].slice(0, limit);
}

/** Le produit vedette de la Home (le premier marqué `featured`, sinon le premier du catalogue). */
export function featuredProduct(products: Product[]): Product | undefined {
  return products.find((p) => p.featured) ?? products[0];
}

/** Produits de la même catégorie, hors le produit lui-même. */
export function relatedTo(products: Product[], productId: string, limit = 4): Product[] {
  const current = products.find((p) => p.id === productId);
  if (!current) return [];
  return products.filter((p) => p.cat === current.cat && p.id !== current.id).slice(0, limit);
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
export function filterCatalog(products: Product[], filters: CatalogFilters): Product[] {
  let list = products.filter((p) => filters.cat === "Tous" || p.cat === filters.cat);
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

Note on test safety without a real DB: `getCatalog`/`getProductById` are not called by any test in this task (see spec §5 — they're verified via `execute_sql` + live browser in Task 10, not Vitest). Merely importing this module (as `catalog.test.ts` does) constructs the `PrismaPg`/`PrismaClient` singleton but performs no network I/O until a query actually runs, so this stays safe even before Task 2's real credentials are in place.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run lib/data/catalog.test.ts`
Expected: PASS, all tests green.

Run: `npm run typecheck`
Expected: no errors. (Consumers not yet updated — `ProductGridBlock.tsx`, `FeaturedProductBlock.tsx`, `CategoryTilesBlock.tsx`, `CatalogView.tsx`, `ProductView.tsx`, `app/(storefront)/produit/[id]/page.tsx`, and the 5 dashboard screens plus their pages — will fail typecheck until their own tasks land. If `npm run typecheck` fails here on those exact files with the exact old call signatures, that's expected and will be resolved by Tasks 5-9; don't fix them in this task.)

- [ ] **Step 5: Commit**

```bash
git add lib/data/catalog.ts lib/data/catalog.test.ts
git commit -m "refactor: read the product catalog from Postgres via Prisma"
```

---

### Task 4: `computeEffectiveStock` signature change + dead-code removal

**Files:**
- Modify: `lib/store/shopLogic.ts`
- Modify: `lib/store/shopLogic.test.ts`
- Modify: `lib/store/useShop.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `computeEffectiveStock(productId: string, baseStock: number, deductions: Record<string, number>): number` — every later task's components call it with this 3-arg shape.

- [ ] **Step 1: Update the test first (will fail against the old implementation)**

In `lib/store/shopLogic.test.ts`, replace the `computeEffectiveStock` describe block:

Old:
```ts
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
```

New:
```ts
describe("computeEffectiveStock", () => {
  it("returns the base stock with no deduction", () => {
    expect(computeEffectiveStock("p1", 24, {})).toBe(24);
  });

  it("subtracts a recorded deduction", () => {
    expect(computeEffectiveStock("p1", 24, { p1: 10 })).toBe(14);
  });

  it("clamps at zero if the deduction exceeds stock", () => {
    expect(computeEffectiveStock("p1", 24, { p1: 999 })).toBe(0);
  });

  it("ignores deductions recorded under a different product id", () => {
    expect(computeEffectiveStock("p1", 24, { p9: 999 })).toBe(24);
  });
});
```

(The old "unknown product id" case no longer applies — the function no longer looks anything up by id, the caller always supplies `baseStock` directly. Replaced with an equally meaningful edge case: deductions keyed to other products don't leak in.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run lib/store/shopLogic.test.ts`
Expected: FAIL — wrong number of arguments / assertions don't match the old 2-arg implementation.

- [ ] **Step 3: Update the implementation**

In `lib/store/shopLogic.ts`, remove the catalog import (line 1) and replace the function:

Old:
```ts
import { catalog } from "@/lib/data/catalog";
import { fmt, money } from "@/lib/format";
import type { Order, OrderLine, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";
```
```ts
/** Stock effectif = stock de base moins les déductions déjà appliquées (jamais négatif). */
export function computeEffectiveStock(productId: string, deductions: Record<string, number>): number {
  const product = catalog.find((p) => p.id === productId);
  if (!product) return 0;
  const deducted = deductions[productId] ?? 0;
  return Math.max(0, product.stock - deducted);
}
```

New:
```ts
import { fmt, money } from "@/lib/format";
import type { Order, OrderLine, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";
```
```ts
/** Stock effectif = stock de base moins les déductions déjà appliquées (jamais négatif). */
export function computeEffectiveStock(productId: string, baseStock: number, deductions: Record<string, number>): number {
  const deducted = deductions[productId] ?? 0;
  return Math.max(0, baseStock - deducted);
}
```

- [ ] **Step 4: Remove the dead `effectiveStock` action from `useShop.ts`**

This store action already had zero callers anywhere in the codebase (flagged as dead code in `docs/superpowers/EXECUTION-STATUS.md`, confirmed by two independent prior reviews) and calls `computeEffectiveStock` with the old 2-arg signature — it must go or it breaks typecheck.

In `lib/store/useShop.ts`, remove the import of `computeEffectiveStock` (keep the others) and the two lines defining the action:

Old:
```ts
import {
  applyConfirmOnce,
  buildWebOrder,
  computeEffectiveStatus,
  computeEffectiveStock,
  countPending,
  type WebCartLine,
} from "./shopLogic";
```
```ts
  effectiveStatus: (orderId: string) => OrderStatus;
  effectiveStock: (productId: string) => number;
  pendingCount: () => number;
```
```ts
      effectiveStock: (productId) => computeEffectiveStock(productId, get().stockDeductions),

```

New:
```ts
import {
  applyConfirmOnce,
  buildWebOrder,
  computeEffectiveStatus,
  countPending,
  type WebCartLine,
} from "./shopLogic";
```
```ts
  effectiveStatus: (orderId: string) => OrderStatus;
  pendingCount: () => number;
```
(the `effectiveStock: (productId) => ...` line and the blank line after it are deleted entirely — no replacement)

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run lib/store/shopLogic.test.ts`
Expected: PASS, all tests green.

Run: `npm run test`
Expected: same total pass count as before this task minus zero (no test referenced the removed `effectiveStock` action — confirmed by a repo-wide grep during planning).

Run: `npm run typecheck`
Expected: still shows errors in the not-yet-updated consumers (`ProductGridBlock.tsx`, `FeaturedProductBlock.tsx`, `CatalogView.tsx`, `ProductView.tsx`, `InventoryScreen.tsx`) calling `computeEffectiveStock` with the old 2-arg shape — expected until Tasks 5, 7, 8, 9 land.

- [ ] **Step 6: Commit**

```bash
git add lib/store/shopLogic.ts lib/store/shopLogic.test.ts lib/store/useShop.ts
git commit -m "refactor: drop shopLogic's dependency on the static catalog

computeEffectiveStock now takes the product's base stock as an explicit
argument instead of looking it up in lib/data/catalog, which is about to
stop exporting a static array. Also removes useShop's effectiveStock
action, dead code with zero callers that called the old 2-arg signature."
```

---

### Task 5: Home page — product blocks read from Postgres

**Files:**
- Modify: `components/storefront/blocks/registry.ts`
- Modify: `components/storefront/blocks/ProductGridBlock.tsx`
- Modify: `components/storefront/blocks/FeaturedProductBlock.tsx`
- Modify: `components/storefront/blocks/CategoryTilesBlock.tsx`
- Create: `components/storefront/HomeShell.tsx`
- Modify: `app/(storefront)/page.tsx`

**Interfaces:**
- Consumes: `getCatalog()` (Task 3), `computeEffectiveStock(productId, baseStock, deductions)` (Task 4).
- Produces: `blockRegistry: Partial<Record<BlockId, ComponentType<{ products?: Product[] }>>>` — every block receives the full product array uniformly; blocks that don't need it ignore the prop.

- [ ] **Step 1: Update the block registry type**

Replace `components/storefront/blocks/registry.ts` in full:

```ts
import type { ComponentType } from "react";
import type { BlockId } from "@/lib/store/useStorefront";
import type { Product } from "@/lib/data/types";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";
import { FeaturedProductBlock } from "./FeaturedProductBlock";
import { StoryBlock } from "./StoryBlock";
import { LookbookBlock } from "./LookbookBlock";
import { NewsletterBlock } from "./NewsletterBlock";
import { ContactBlock } from "./ContactBlock";

/**
 * type → composant de rendu. Chaque bloc ajouté ici devient immédiatement
 * disponible sur la Home, réordonnable/masquable en mode éditeur — préfigure
 * le futur éditeur de vitrine complet (SECTIONS.md §1).
 */
export const blockRegistry: Partial<Record<BlockId, ComponentType<{ products?: Product[] }>>> = {
  hero: HeroBlock,
  cats: CategoryTilesBlock,
  grid: ProductGridBlock,
  loyalty: LoyaltyBannerBlock,
  featured: FeaturedProductBlock,
  story: StoryBlock,
  look: LookbookBlock,
  news: NewsletterBlock,
  contact: ContactBlock,
};
```

- [ ] **Step 2: `ProductGridBlock` reads products from props**

Replace `components/storefront/blocks/ProductGridBlock.tsx` in full:

```tsx
"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { newestProducts } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";
import { BlockFrame } from "./BlockFrame";

export function ProductGridBlock({ products = [] }: { products?: Product[] }) {
  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
  const featured = newestProducts(products, 4);

  return (
    <BlockFrame id="grid">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
            <div>
              <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 6 }}>
                À la une
              </div>
              <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
                Nouveautés &amp; best-sellers
              </h2>
            </div>
            <Link href="/catalogue" style={{ font: `600 14px ${fonts.ui}`, color: colors.primary, whiteSpace: "nowrap" }}>
              Tout voir →
            </Link>
          </div>
          <div className="ft-store-home-grid" style={{ display: "grid" }}>
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                stock={computeEffectiveStock(p.id, p.stock, stockDeductions)}
                onAdd={() => {
                  addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                  showToast("Ajouté au panier", "success");
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 3: `FeaturedProductBlock` reads products from props**

Replace `components/storefront/blocks/FeaturedProductBlock.tsx` in full:

```tsx
"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { featuredProduct } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";
import { BlockFrame } from "./BlockFrame";

export function FeaturedProductBlock({ products = [] }: { products?: Product[] }) {
  const product = featuredProduct(products);
  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  if (!product) return null;

  const stock = computeEffectiveStock(product.id, product.stock, stockDeductions);

  return (
    <BlockFrame id="featured">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-feat" style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, overflow: "hidden", display: "grid" }}>
            <div className="ft-store-feat-img" style={{ position: "relative", background: stripe(product.colors[0]), display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", top: 14, left: 14, font: `700 11px ${fonts.ui}`, padding: "5px 10px", borderRadius: 999, background: "#1E1B18", color: colors.gold, border: `1px solid ${colors.gold}` }}>
                ★ Coup de cœur
              </span>
            </div>
            <div className="ft-store-feat-pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 10 }}>
                Édition limitée
              </div>
              <h3 className="ft-store-feat-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.1, margin: "0 0 10px" }}>
                {product.name}
              </h3>
              <p style={{ fontSize: 15, color: colors.muted, lineHeight: 1.55, margin: "0 0 18px" }}>{product.description}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
                <span style={{ fontSize: 14, color: colors.muted }}>· {product.lengths[0]}</span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href={`/produit/${product.id}`}
                  style={{ height: 48, padding: "0 26px", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}
                >
                  Voir le produit
                </Link>
                <button
                  onClick={() => {
                    if (stock <= 0) { showToast("Article épuisé", "error"); return; }
                    addToCart({ productId: product.id, name: product.name, variant: product.lengths[0], colorHex: product.colors[0], price: product.price });
                    showToast("Ajouté au panier", "success");
                  }}
                  style={{ height: 48, padding: "0 22px", border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
                >
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
```

- [ ] **Step 4: `CategoryTilesBlock` reads products from props**

Replace `components/storefront/blocks/CategoryTilesBlock.tsx` in full:

```tsx
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { storefrontCategories } from "@/lib/data/catalog";
import type { Product } from "@/lib/data/types";
import { BlockFrame } from "./BlockFrame";

const TILE_COLOR: Record<string, string> = {
  Foulards: "#26326B",
  Turbans: "#D07A34",
  Accessoires: "#C9A227",
};

export function CategoryTilesBlock({ products = [] }: { products?: Product[] }) {
  return (
    <BlockFrame id="cats">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-cats" style={{ display: "grid", gap: 14 }}>
            {storefrontCategories.map((cat) => {
              const count = products.filter((p) => p.cat === cat).length;
              return (
                <Link
                  key={cat}
                  href={`/catalogue?cat=${encodeURIComponent(cat)}`}
                  style={{
                    position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "4 / 3",
                    background: stripe(TILE_COLOR[cat]), display: "block",
                  }}
                >
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

- [ ] **Step 5: Extract the Home page's client body into `HomeShell`**

The Home page (`app/(storefront)/page.tsx`) is currently itself `"use client"` (it needs `useStorefront`'s `blockOrder`/`blocksMode` for the drag-and-drop block editor), so it cannot become an async Server Component directly — a Server Component must sit above it to do the fetch. Move its exact current body into a new Client Component that accepts the fetched products as a prop.

Create `components/storefront/HomeShell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { Icon } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { blockRegistry } from "@/components/storefront/blocks/registry";
import type { Product } from "@/lib/data/types";

export function HomeShell({ products }: { products: Product[] }) {
  const blockOrder = useStorefront((s) => s.blockOrder);
  const blocksMode = useStorefront((s) => s.blocksMode);
  const toggleBlocksMode = useStorefront((s) => s.toggleBlocksMode);

  const renderableOrder = blockOrder.filter((id) => id in blockRegistry);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {blocksMode && (
        <div
          style={{
            position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 10,
            maxWidth: 1200, margin: "12px auto 0", width: "calc(100% - 32px)",
            background: "#FBF1D8", border: "1px solid #EBD9A6", borderRadius: 12, padding: "11px 14px",
          }}
        >
          <span style={{ fontSize: 13, color: "#7a5a00", lineHeight: 1.4 }}>
            Mode éditeur — renommez un bloc, réordonnez-le (↑↓) ou masquez-le (œil). Chaque bloc est empilable et éditable sans code.
          </span>
        </div>
      )}

      {renderableOrder.map((id) => {
        const Block = blockRegistry[id]!;
        return <Block key={id} products={products} />;
      })}

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
            <div>WhatsApp</div>
            <div>Livraison</div>
            <div>Points de fidélité</div>
          </div>
        </div>
      </footer>

      <button
        onClick={toggleBlocksMode}
        style={{
          position: "fixed", right: 20, bottom: 28, zIndex: 55, height: 46, padding: "0 18px",
          border: "none", borderRadius: 999, background: blocksMode ? "#D07A34" : "#1E1B18", color: "#fff",
          font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
          boxShadow: "0 8px 24px rgba(30,27,24,.28)",
        }}
      >
        <Icon path='<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/>' size={18} stroke="#fff" strokeWidth={1.85} />
        {blocksMode ? "Quitter l'aperçu" : "Aperçu des blocs"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: `app/(storefront)/page.tsx` becomes an async Server Component**

Replace `app/(storefront)/page.tsx` in full:

```tsx
import { getCatalog } from "@/lib/data/catalog";
import { HomeShell } from "@/components/storefront/HomeShell";

export default async function StorefrontHomePage() {
  const products = await getCatalog();
  return <HomeShell products={products} />;
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck`
Expected: no errors in any of the 6 files touched this task (other consumers of `computeEffectiveStock`/`catalog` not yet migrated may still show errors — expected until their own tasks land).

Run: `npm run test`
Expected: same pass count as after Task 4 (no test covers these UI components directly).

- [ ] **Step 8: Live verification**

Start the dev server (`next dev --webpack`, per the Turbopack workaround already configured in `.claude/launch.json`) and open `/`. Expected: the 12 real products render in the "Nouveautés & best-sellers" grid, the featured block, and the category tile counts — same visual content as before (since the seed data matches the old mock 1:1), block editor mode (bottom-right button) still lets you reorder/hide/rename blocks.

- [ ] **Step 9: Commit**

```bash
git add components/storefront/blocks/registry.ts components/storefront/blocks/ProductGridBlock.tsx components/storefront/blocks/FeaturedProductBlock.tsx components/storefront/blocks/CategoryTilesBlock.tsx components/storefront/HomeShell.tsx "app/(storefront)/page.tsx"
git commit -m "feat: source Home page product blocks from the real catalog"
```

---

### Task 6: Catalogue page reads from Postgres

**Files:**
- Modify: `components/storefront/views/CatalogView.tsx`
- Modify: `app/(storefront)/catalogue/page.tsx`

**Interfaces:**
- Consumes: `getCatalog()`, `filterCatalog(products, filters)` (Task 3), `computeEffectiveStock(productId, baseStock, deductions)` (Task 4).
- Produces: `CatalogView({ products: Product[] })` — the full catalog to filter client-side.

- [ ] **Step 1: `CatalogView` accepts a `products` prop**

Replace `components/storefront/views/CatalogView.tsx` in full:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { filterCatalog, categories, type CatalogFilters } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";

const COLOR_SWATCHES = [
  { hex: "#26326B", label: "Indigo" },
  { hex: "#D07A34", label: "Terracotta" },
  { hex: "#C9A227", label: "Or" },
  { hex: "#0E9F6E", label: "Vert" },
  { hex: "#1E1B18", label: "Noir" },
];
const MOTIFS = ["Wax", "Bazin", "Uni", "Kente", "Tie & dye"];

export function CatalogView({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const initialCat = (searchParams.get("cat") as CatalogFilters["cat"]) || "Tous";

  const [filters, setFilters] = useState<CatalogFilters>({
    cat: initialCat,
    color: "",
    motif: "",
    priceMax: 40000,
    query: "",
    sort: "new",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(timer);
  }, [filters.cat, filters.color, filters.motif, filters.priceMax, filters.query, filters.sort]);

  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const filtered = useMemo(() => filterCatalog(products, filters), [products, filters]);

  const setFilter = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters({ cat: "Tous", color: "", motif: "", priceMax: 40000, query: "", sort: "new" });

  return (
    <div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: filters.cat === "Tous" ? "Toute la boutique" : filters.cat }]} />
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-.01em" }}>
        {filters.cat === "Tous" ? "Toute la boutique" : filters.cat}
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 20px" }}>
        {filtered.length} produit{filtered.length > 1 ? "s" : ""}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", height: 46, padding: "0 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", gap: 10 }}>
          <Icon path={ICONS.search} size={18} stroke={colors.muted} strokeWidth={1.75} />
          <input
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder="Rechercher un foulard, un motif…"
            style={{ flex: 1, border: "none", outline: "none", font: `400 15px ${fonts.ui}`, color: colors.ink, background: "transparent" }}
          />
        </div>
        <select
          value={filters.sort}
          onChange={(e) => setFilter("sort", e.target.value as CatalogFilters["sort"])}
          style={{ height: 46, padding: "0 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `500 14px ${fonts.ui}`, color: colors.ink, cursor: "pointer" }}
        >
          <option value="new">Nouveautés</option>
          <option value="asc">Prix croissant</option>
          <option value="desc">Prix décroissant</option>
        </select>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="ft-mobile-only"
          style={{ height: 46, padding: "0 16px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `600 14px ${fonts.ui}`, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <Icon path='<path d="M4 6h16M7 12h10M10 18h4"/>' size={18} stroke={colors.ink} strokeWidth={1.75} />
          Filtres
        </button>
      </div>

      <div className="ft-store-catalog-layout" style={{ display: "grid", gap: 24, alignItems: "start" }}>
        <aside
          className={filtersOpen ? undefined : "ft-desktop-only"}
          style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "20px 22px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ font: `600 15px ${fonts.ui}` }}>Filtres</span>
            <span onClick={clearFilters} style={{ font: `500 13px ${fonts.ui}`, color: colors.primary, cursor: "pointer" }}>
              Réinitialiser
            </span>
          </div>

          <FilterLabel>Catégorie</FilterLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
            {categories.map((c) => (
              <span
                key={c}
                onClick={() => setFilter("cat", c)}
                style={{
                  padding: "8px 10px", borderRadius: 8, font: `500 14px ${fonts.ui}`, cursor: "pointer",
                  background: filters.cat === c ? colors.bgInfo : "transparent",
                  color: filters.cat === c ? colors.primary : colors.ink,
                }}
              >
                {c}
              </span>
            ))}
          </div>

          <FilterLabel>Couleur</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {COLOR_SWATCHES.map((c) => (
              <span
                key={c.hex}
                onClick={() => setFilter("color", filters.color === c.hex ? "" : c.hex)}
                title={c.label}
                style={{ width: 32, height: 32, borderRadius: 999, background: c.hex, cursor: "pointer", outline: filters.color === c.hex ? `2px solid ${colors.ink}` : "2px solid transparent", outlineOffset: 2 }}
              />
            ))}
          </div>

          <FilterLabel>Motif</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {MOTIFS.map((m) => {
              const active = filters.motif === m;
              return (
                <span
                  key={m}
                  onClick={() => setFilter("motif", active ? "" : m)}
                  style={{
                    height: 34, padding: "0 13px", display: "inline-flex", alignItems: "center", borderRadius: 999,
                    font: `600 13px ${fonts.ui}`, cursor: "pointer",
                    border: `1.5px solid ${active ? colors.primary : colors.borderField}`,
                    background: active ? colors.primary : "#fff",
                    color: active ? "#fff" : colors.muted,
                  }}
                >
                  {m}
                </span>
              );
            })}
          </div>

          <FilterLabel>Prix max · {money(filters.priceMax)}</FilterLabel>
          <input
            type="range"
            min={4000}
            max={40000}
            step={500}
            value={filters.priceMax}
            onChange={(e) => setFilter("priceMax", parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: colors.primary, cursor: "pointer" }}
          />
        </aside>

        <div>
          {loading ? (
            <div className="ft-store-catalog-grid" style={{ display: "grid", gap: 18 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
                  <div className="ft-skeleton" style={{ aspectRatio: "4 / 5" }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div className="ft-skeleton" style={{ height: 14, width: "70%", marginBottom: 9 }} />
                    <div className="ft-skeleton" style={{ height: 12, width: "45%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 999, background: "#F4F0E9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon path={ICONS.search} size={28} stroke="#B6AEA1" strokeWidth={1.6} />
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Aucun résultat</div>
              <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 20px", maxWidth: 320 }}>
                Aucun produit ne correspond à ces filtres. Essayez d&apos;élargir votre recherche.
              </p>
              <button
                onClick={clearFilters}
                style={{ height: 46, padding: "0 24px", border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="ft-store-catalog-grid" style={{ display: "grid", gap: 18 }}>
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  stock={computeEffectiveStock(p.id, p.stock, stockDeductions)}
                  onAdd={() => {
                    addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                    showToast("Ajouté au panier", "success");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: `600 12px ${fonts.ui}`, textTransform: "uppercase", letterSpacing: ".06em", color: colors.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `app/(storefront)/catalogue/page.tsx` fetches server-side**

Replace `app/(storefront)/catalogue/page.tsx` in full:

```tsx
import { Suspense } from "react";
import { getCatalog } from "@/lib/data/catalog";
import { CatalogView } from "@/components/storefront/views/CatalogView";

export default async function CataloguePage() {
  const products = await getCatalog();
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }} />}>
      <CatalogView products={products} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors in these 2 files.

Run: `npm run test`
Expected: same pass count as after Task 5.

- [ ] **Step 4: Live verification**

Open `/catalogue` and `/catalogue?cat=Turbans`. Expected: 12 products / 1 product (Turban Bazin Or) respectively, search/color/motif/price filters all still work exactly as before, "Aucun résultat" empty state still reachable (e.g. price slider at minimum).

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/CatalogView.tsx "app/(storefront)/catalogue/page.tsx"
git commit -m "feat: source the Catalogue page from the real product catalog"
```

---

### Task 7: Product page reads from Postgres (related products computed server-side)

**Files:**
- Modify: `components/storefront/views/ProductView.tsx`
- Modify: `app/(storefront)/produit/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCatalog()`, `getProductById(id)`, `relatedTo(products, productId)` (Task 3), `computeEffectiveStock` (Task 4).
- Produces: `ProductView({ product: Product; related: Product[] })` — `related` is now computed by the page (Server Component), not by `ProductView` itself, since `ProductView` is a Client Component and can't call the async Prisma-backed `getCatalog()`.

- [ ] **Step 1: `ProductView` receives `related` as a prop**

In `components/storefront/views/ProductView.tsx`, remove the `relatedTo` import and the internal computation, and update both `computeEffectiveStock` call sites to the 3-arg signature.

Old:
```tsx
import { relatedTo } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
import { useStorefront } from "@/lib/store/useStorefront";
import { money, fmt } from "@/lib/format";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { AvailabilityChip } from "@/components/storefront/AvailabilityChip";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";
```
```tsx
export function ProductView({ product }: { product: Product }) {
  const router = useRouter();
  const [colorIdx, setColorIdx] = useState(0);
  const [lenIdx, setLenIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);

  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const stock = computeEffectiveStock(product.id, stockDeductions);
  const soldOut = stock <= 0;
  const variant = product.lengths[lenIdx];
  const related = relatedTo(product.id);
```

New:
```tsx
import { useShop } from "@/lib/store/useShop";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
import { useStorefront } from "@/lib/store/useStorefront";
import { money, fmt } from "@/lib/format";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { AvailabilityChip } from "@/components/storefront/AvailabilityChip";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";
```
```tsx
export function ProductView({ product, related }: { product: Product; related: Product[] }) {
  const router = useRouter();
  const [colorIdx, setColorIdx] = useState(0);
  const [lenIdx, setLenIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);

  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const stock = computeEffectiveStock(product.id, product.stock, stockDeductions);
  const soldOut = stock <= 0;
  const variant = product.lengths[lenIdx];
```

And further down, in the "Vous aimerez aussi" section:

Old:
```tsx
                stock={computeEffectiveStock(p.id, stockDeductions)}
```

New:
```tsx
                stock={computeEffectiveStock(p.id, p.stock, stockDeductions)}
```

- [ ] **Step 2: `produit/[id]/page.tsx` fetches the product and its related products server-side**

Replace `app/(storefront)/produit/[id]/page.tsx` in full:

```tsx
import { notFound } from "next/navigation";
import { getCatalog, getProductById, relatedTo } from "@/lib/data/catalog";
import { ProductView } from "@/components/storefront/views/ProductView";

export async function generateStaticParams() {
  const products = await getCatalog();
  return products.map((p) => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const products = await getCatalog();
  const related = relatedTo(products, product.id);
  return <ProductView product={product} related={related} />;
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors in these 2 files.

Run: `npm run test`
Expected: same pass count as after Task 6.

- [ ] **Step 4: Live verification**

Open `/produit/p2` (the featured Kente scarf). Expected: name/price/description/colors/lengths render correctly, availability chip shows the right tier, "Vous aimerez aussi" shows p1 and p4 (same-category Foulards, excluding p2 itself — matching the `relatedTo` test), an unknown id (`/produit/nope`) 404s.

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/ProductView.tsx "app/(storefront)/produit/[id]/page.tsx"
git commit -m "feat: source the Product page from the real product catalog"
```

---

### Task 8: Inventory & Dashboard screens — real stock, effective-stock fix

**Files:**
- Modify: `components/dashboard/screens/InventoryScreen.tsx`
- Modify: `components/dashboard/screens/DashboardScreen.tsx`
- Modify: `app/(dashboard)/inventaire/page.tsx`
- Modify: `app/(dashboard)/tableau-de-bord/page.tsx`

**Interfaces:**
- Consumes: `getCatalog()` (Task 3), `computeEffectiveStock(productId, baseStock, deductions)` (Task 4).
- Produces: `InventoryScreen({ products: Product[] })`, `DashboardScreen({ products: Product[] })`.

- [ ] **Step 1: `InventoryScreen` reads products from props**

In `components/dashboard/screens/InventoryScreen.tsx`:

Old:
```tsx
import { catalog } from "@/lib/data/catalog";
```
```tsx
export function InventoryScreen() {
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const stockDeductions = useShop((s) => s.stockDeductions);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      catalog.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      ),
    [q]
  );

  const drawerProduct = drawerId ? catalog.find((p) => p.id === drawerId) ?? null : null;
```

New:
```tsx
```
(remove the `catalog` import entirely — `Product` is already imported via `import type { Product } from "@/lib/data/types";`)
```tsx
export function InventoryScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const stockDeductions = useShop((s) => s.stockDeductions);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      products.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      ),
    [products, q]
  );

  const drawerProduct = drawerId ? products.find((p) => p.id === drawerId) ?? null : null;
```

Further down, update the two `computeEffectiveStock` call sites and the footer count:

Old:
```tsx
                const s1 = computeEffectiveStock(p.id, stockDeductions);
```
New:
```tsx
                const s1 = computeEffectiveStock(p.id, p.stock, stockDeductions);
```

Old:
```tsx
            {rows.length} produits · {catalog.length} au total
```
New:
```tsx
            {rows.length} produits · {products.length} au total
```

Old (inside `EditDrawer`):
```tsx
  const s1 = computeEffectiveStock(p.id, stockDeductions);
```
New:
```tsx
  const s1 = computeEffectiveStock(p.id, p.stock, stockDeductions);
```

- [ ] **Step 2: `DashboardScreen` reads products from props and uses effective stock for the low-stock alert**

In `components/dashboard/screens/DashboardScreen.tsx`:

Old:
```tsx
import { catalog } from "@/lib/data/catalog";
import { computeEffectiveStatus } from "@/lib/store/shopLogic";
```
```tsx
export function DashboardScreen() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [range, setRange] = useState<"7" | "30">("7");
  const orders = useShop((s) => s.orders);
  const overrides = useShop((s) => s.statusOverrides);
```
```tsx
  const lowStock = catalog.filter((p) => p.stock <= 9).slice(0, 4);
  const lowStockCount = catalog.filter((p) => p.stock <= 9).length;
```

New:
```tsx
import type { Product } from "@/lib/data/types";
import { computeEffectiveStatus, computeEffectiveStock } from "@/lib/store/shopLogic";
```
```tsx
export function DashboardScreen({ products }: { products: Product[] }) {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [range, setRange] = useState<"7" | "30">("7");
  const orders = useShop((s) => s.orders);
  const overrides = useShop((s) => s.statusOverrides);
  const stockDeductions = useShop((s) => s.stockDeductions);
```
```tsx
  const lowStockAlerts = products
    .map((p) => ({ ...p, effectiveStock: computeEffectiveStock(p.id, p.stock, stockDeductions) }))
    .filter((p) => p.effectiveStock <= 9);
  const lowStock = lowStockAlerts.slice(0, 4);
  const lowStockCount = lowStockAlerts.length;
```

And in the render loop, use the effective stock instead of the base stock:

Old:
```tsx
          {lowStock.map((s) => (
            <div key={s.id} style={rowStyle}>
              <span style={{ width: 36, height: 36, borderRadius: 8, flex: "none", background: s.swatch }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ellip}>{s.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>Seuil 10 · {s.variant}</div>
              </div>
              <span style={{ font: `700 13px ${fonts.ui}`, color: s.stock <= 5 ? colors.danger : colors.warning }}>
                {s.stock}
              </span>
            </div>
          ))}
```

New:
```tsx
          {lowStock.map((s) => (
            <div key={s.id} style={rowStyle}>
              <span style={{ width: 36, height: 36, borderRadius: 8, flex: "none", background: s.swatch }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ellip}>{s.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>Seuil 10 · {s.variant}</div>
              </div>
              <span style={{ font: `700 13px ${fonts.ui}`, color: s.effectiveStock <= 5 ? colors.danger : colors.warning }}>
                {s.effectiveStock}
              </span>
            </div>
          ))}
```

- [ ] **Step 3: `app/(dashboard)/inventaire/page.tsx` fetches server-side**

Replace in full:

```tsx
import { getCatalog } from "@/lib/data/catalog";
import { InventoryScreen } from "@/components/dashboard/screens/InventoryScreen";

export default async function InventoryPage() {
  const products = await getCatalog();
  return <InventoryScreen products={products} />;
}
```

- [ ] **Step 4: `app/(dashboard)/tableau-de-bord/page.tsx` fetches server-side**

Replace in full:

```tsx
import { getCatalog } from "@/lib/data/catalog";
import { DashboardScreen } from "@/components/dashboard/screens/DashboardScreen";

export default async function DashboardPage() {
  const products = await getCatalog();
  return <DashboardScreen products={products} />;
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: no errors in these 4 files.

Run: `npm run test`
Expected: same pass count as after Task 7.

- [ ] **Step 6: Live verification**

Open `/admin/inventaire`. Expected: 12 rows, "Interne" column shows real stock (24, 6, 14, 31, 9, 4, 11, 17, 22, 3, 8, 19 in seed order), footer reads "12 produits · 12 au total". Open `/admin/tableau-de-bord`. Expected: "Alertes stock bas" shows the same products that would appear ≤9 effective in Inventory (p2, p6, p5 if p5=9, p10, p11 depending on current deductions — cross-check against the Inventory screen's effective values, not raw seed stock, since the two screens must now agree).

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/screens/InventoryScreen.tsx components/dashboard/screens/DashboardScreen.tsx "app/(dashboard)/inventaire/page.tsx" "app/(dashboard)/tableau-de-bord/page.tsx"
git commit -m "feat: source Inventory and Dashboard screens from the real catalog

Also fixes DashboardScreen's low-stock alert to use effective stock
(base minus confirmed-order deductions) instead of raw base stock,
matching InventoryScreen's behavior since Plan 1 Task 13."
```

---

### Task 9: Marketing, Theme & POS screens — mechanical data-source swap

**Files:**
- Modify: `components/dashboard/screens/MarketingScreen.tsx`
- Modify: `components/dashboard/screens/ThemeScreen.tsx`
- Modify: `components/dashboard/screens/PosScreen.tsx`
- Modify: `app/(dashboard)/marketing/page.tsx`
- Modify: `app/(dashboard)/personnalisation/page.tsx`
- Modify: `app/(dashboard)/pos/page.tsx`

**Interfaces:**
- Consumes: `getCatalog()` (Task 3).
- Produces: `MarketingScreen({ products: Product[] })`, `ThemeScreen({ products: Product[] })`, `PosScreen({ products: Product[] })`.

No stock-logic changes in this task — these 3 screens use products for decorative sampling (`MarketingScreen`) or a live preview (`ThemeScreen`) or the POS catalog grid (`PosScreen`), none of which touch `computeEffectiveStock`.

- [ ] **Step 1: `MarketingScreen` computes its sample lists from the `products` prop**

`STARS`/`DORMANT` were module-level constants indexing into the static `catalog` array at import time — since there's no more module-level array, they move inside the component body, indexing into the `products` prop instead.

Old:
```tsx
import { catalog } from "@/lib/data/catalog";
import { money } from "@/lib/format";

const STARS = [
  { p: catalog[4], sold: 128 },
  { p: catalog[0], sold: 96 },
  { p: catalog[6], sold: 74 },
  { p: catalog[2], sold: 61 },
];
const DORMANT = [
  { p: catalog[9], days: 52 },
  { p: catalog[5], days: 41 },
  { p: catalog[7], days: 38 },
  { p: catalog[10], days: 29 },
];
const PROMOS = [
  { code: "TERANGA10", desc: "−10% dès 25 000 FCFA", period: "01/07 → 31/07/2026", used: 34 },
  { code: "VIP15", desc: "−15% clientes VIP", period: "Permanent", used: 12 },
];

export function MarketingScreen() {
```

New:
```tsx
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";

const PROMOS = [
  { code: "TERANGA10", desc: "−10% dès 25 000 FCFA", period: "01/07 → 31/07/2026", used: 34 },
  { code: "VIP15", desc: "−15% clientes VIP", period: "Permanent", used: 12 },
];

export function MarketingScreen({ products }: { products: Product[] }) {
  const STARS = [
    { p: products[4], sold: 128 },
    { p: products[0], sold: 96 },
    { p: products[6], sold: 74 },
    { p: products[2], sold: 61 },
  ];
  const DORMANT = [
    { p: products[9], days: 52 },
    { p: products[5], days: 41 },
    { p: products[7], days: 38 },
    { p: products[10], days: 29 },
  ];
```

(the `return (` that follows is unchanged — `STARS`/`DORMANT`/`PROMOS` are used exactly as before in the JSX below)

- [ ] **Step 2: `ThemeScreen` previews real products**

Old:
```tsx
import { catalog } from "@/lib/data/catalog";
import { money } from "@/lib/format";
```
```tsx
export function ThemeScreen() {
  const [th, setTh] = useState<ThemeState>(DEFAULTS);
  const set = <K extends keyof ThemeState>(k: K, v: ThemeState[K]) => setTh((s) => ({ ...s, [k]: v }));

  const previewFont = th.font === "Inter" ? fonts.ui : fonts.display;
  const heroBg = `linear-gradient(180deg, ${hexA(th.accent, 0.1)}, #fff)`;
  const initial = (th.shopName || "T").trim().charAt(0).toUpperCase();
  const previewProducts = [catalog[0], catalog[1], catalog[2]];
```

New:
```tsx
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";
```
```tsx
export function ThemeScreen({ products }: { products: Product[] }) {
  const [th, setTh] = useState<ThemeState>(DEFAULTS);
  const set = <K extends keyof ThemeState>(k: K, v: ThemeState[K]) => setTh((s) => ({ ...s, [k]: v }));

  const previewFont = th.font === "Inter" ? fonts.ui : fonts.display;
  const heroBg = `linear-gradient(180deg, ${hexA(th.accent, 0.1)}, #fff)`;
  const initial = (th.shopName || "T").trim().charAt(0).toUpperCase();
  const previewProducts = [products[0], products[1], products[2]];
```

- [ ] **Step 3: `PosScreen` reads the catalog from props**

Old:
```tsx
import { catalog, categories } from "@/lib/data/catalog";
```
```tsx
export function PosScreen() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof categories)[number]>("Tous");

  const cart = useBackoffice((s) => s.cart);
  const cartOpen = useBackoffice((s) => s.cartOpen);
  const showToast = useBackoffice((s) => s.showToast);
  const openCart = useBackoffice((s) => s.openCart);
  const closeCart = useBackoffice((s) => s.closeCart);

  const q = query.trim().toLowerCase();
  const products = useMemo(
    () =>
      catalog.filter(
        (p) => (cat === "Tous" || p.cat === cat) && (!q || p.name.toLowerCase().includes(q))
      ),
    [cat, q]
  );
```

New:
```tsx
import { categories } from "@/lib/data/catalog";
import type { Product } from "@/lib/data/types";
```
```tsx
export function PosScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof categories)[number]>("Tous");

  const cart = useBackoffice((s) => s.cart);
  const cartOpen = useBackoffice((s) => s.cartOpen);
  const showToast = useBackoffice((s) => s.showToast);
  const openCart = useBackoffice((s) => s.openCart);
  const closeCart = useBackoffice((s) => s.closeCart);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      products.filter(
        (p) => (cat === "Tous" || p.cat === cat) && (!q || p.name.toLowerCase().includes(q))
      ),
    [products, cat, q]
  );
```

Then, further down, every render-time reference to the old local `products` (the filtered list) becomes `filtered`:

Old:
```tsx
        {products.length === 0 ? (
```
New:
```tsx
        {filtered.length === 0 ? (
```

Old:
```tsx
          <div className="ft-pos-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
```
New:
```tsx
          <div className="ft-pos-grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
```

And the local `ProductCard` helper's prop type, which referenced the now-gone `catalog` constant:

Old:
```tsx
function ProductCard({ product: p }: { product: (typeof catalog)[number] }) {
```
New:
```tsx
function ProductCard({ product: p }: { product: Product }) {
```

- [ ] **Step 4: The 3 dashboard pages fetch server-side**

Replace `app/(dashboard)/marketing/page.tsx` in full:
```tsx
import { getCatalog } from "@/lib/data/catalog";
import { MarketingScreen } from "@/components/dashboard/screens/MarketingScreen";

export default async function MarketingPage() {
  const products = await getCatalog();
  return <MarketingScreen products={products} />;
}
```

Replace `app/(dashboard)/personnalisation/page.tsx` in full:
```tsx
import { getCatalog } from "@/lib/data/catalog";
import { ThemeScreen } from "@/components/dashboard/screens/ThemeScreen";

export default async function PersonnalisationPage() {
  const products = await getCatalog();
  return <ThemeScreen products={products} />;
}
```

Replace `app/(dashboard)/pos/page.tsx` in full:
```tsx
import { getCatalog } from "@/lib/data/catalog";
import { PosScreen } from "@/components/dashboard/screens/PosScreen";

export default async function PosPage() {
  const products = await getCatalog();
  return <PosScreen products={products} />;
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: **zero errors anywhere in the project** — this is the last task touching a `catalog`/`computeEffectiveStock` consumer, so this is the first point where the whole codebase typechecks clean again.

Run: `npm run test`
Expected: all tests green, same or higher count than the pre-migration baseline (75 plus whatever was added/adjusted in Tasks 3-4).

Run: `grep -rn "from \"@/lib/data/catalog\"" app components | grep -v "getCatalog\|getProductById\|filterCatalog\|newestProducts\|featuredProduct\|relatedTo\|categories\|storefrontCategories\|CatalogFilters\|toProduct"`
Expected: no output — confirms nothing in `app/`/`components/` still imports the removed `catalog` constant under any alias.

- [ ] **Step 6: Live verification**

Open `/admin/marketing`: "Produits stars"/"Produits dormants" cards show 4 real products each with plausible names/prices. Open `/admin/personnalisation`: the live preview mini-storefront shows 3 real products in its grid. Open `/admin/pos`: category tabs filter correctly, search filters correctly, tapping a product card still adds it to the cart panel.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/screens/MarketingScreen.tsx components/dashboard/screens/ThemeScreen.tsx components/dashboard/screens/PosScreen.tsx "app/(dashboard)/marketing/page.tsx" "app/(dashboard)/personnalisation/page.tsx" "app/(dashboard)/pos/page.tsx"
git commit -m "feat: source Marketing, Theme and POS screens from the real catalog"
```

---

### Task 10: Whole-branch verification

**Files:** none (verification only).

**Interfaces:** none — this task validates the sub-project's success criteria (spec §7) end to end.

- [ ] **Step 1: Full automated suite**

Run: `npm run test`
Expected: all tests pass.

Run: `npm run typecheck`
Expected: no errors.

Run: `npx next build --webpack`
Expected: builds successfully, route list includes every storefront and dashboard route touched in this plan (Turbopack is expected to panic on this checkout's directory name — use `--webpack`, per `docs/superpowers/EXECUTION-STATUS.md`).

- [ ] **Step 2: Data cross-check against the database**

Run via the Supabase MCP (`mcp__supabase__execute_sql`):
```sql
select count(*) from "Product" where "tenantId" = 'foulard-teranga';
```
Expected: `12`.

- [ ] **Step 3: Live browser walkthrough**

Using the dev server (`next dev --webpack`):
1. `/` — 12 products across the featured/grid/category blocks, editor mode still works.
2. `/catalogue` and `/catalogue?cat=Turbans` — full list and filtered list both correct; search, color, motif, price-range filters all functional.
3. `/produit/p2` — detail page correct, "Vous aimerez aussi" shows p1 and p4.
4. `/admin/pos` — category/search filters work, adding to cart works.
5. `/admin/inventaire` — 12 rows, "Interne" column matches seed stock (minus any deductions from orders confirmed during this session), footer count "12 au total".
6. `/admin/tableau-de-bord` — low-stock alert list matches Inventory's effective-stock values, not raw base stock.
7. `/admin/marketing` and `/admin/personnalisation` — real product names/prices render in both.

Any mismatch here is a real bug — stop and fix it (with a fresh unit test if the bug is in a pure function, otherwise a direct fix + re-verification of the affected step) before considering this sub-project done, per `superpowers:verification-before-completion`.

- [ ] **Step 4: No commit**

This task produces no code changes — if Step 3 finds a bug, fix it as its own small commit before re-running this task's checklist from Step 1.
