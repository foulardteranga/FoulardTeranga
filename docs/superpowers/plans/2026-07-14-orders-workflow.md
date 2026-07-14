# Commandes & workflow (sous-projet 4/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `useShop`'s client-side simulation of order/stock mutations with real Server Actions writing to Postgres via Prisma transactions, for the web order workflow only (KYC → validation → stock deduction).

**Architecture:** Three new server-only modules (`lib/data/orders.server.ts` for reads, `lib/orders/buildOrderLines.ts` + `lib/orders/actions.ts` for writes) replace the entire client-side shadow-state layer in `lib/store/useShop.ts`. Every consumer (storefront checkout/confirmation, back-office orders/dashboard/inventory screens, sidebar badge) migrates from Zustand-store reads to Server-Component-fetched props, and from store actions to direct Server Action calls — same pattern established in sub-project 3 for the product catalog. Because `useShop.ts` is self-contained (nothing else depends on its internals), each consumer can migrate independently without breaking any other not-yet-migrated consumer — the whole plan stays fully green (tests + typecheck) after every single task, no transitional exceptions needed this time.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), Prisma 7 (transactions), Supabase Postgres, TypeScript strict, Vitest, Zustand (cart only, unchanged), Zod.

## Global Constraints

- TypeScript `strict`, never `any` (CLAUDE.md §8).
- Server Components by default; `"use client"` only where interactivity requires it. Mutations via Server Actions validated by Zod, returning `{ok, ...}` — never an unhandled exception to the caller (CLAUDE.md §8).
- **Scope**: web order workflow only. POS (`encaisser`) stays decorative — do not touch `lib/store/useBackoffice.ts`. No Supabase Realtime. No functional "Validation auto" — the toggle is removed, not implemented. No change to the storefront "Compte" page (`lib/data/clients.ts` stays as-is).
- **Security**: the client-supplied cart (localStorage) is never trusted for price or total — `submitWebOrder` always re-reads the current `Product.price` from Postgres by `productId` and recomputes every line total and the order total server-side.
- **Atomicity**: `submitWebOrder` inserts `Order` + `OrderLine[]` together in one Prisma transaction. `confirmOrder` checks stock sufficiency for every line and deducts `Product.stock` in one transaction — all-or-nothing, no partial deduction. If any line's stock is insufficient, the whole confirmation fails with a clear error and nothing is written.
- `npm run test` and `npm run typecheck` must stay green after every task (no exceptions this time — see Architecture above).
- Turbopack panics on this checkout's parent directory name (NFD-decomposed accent) — use `next dev --webpack` / `next build --webpack` for live verification, per `docs/superpowers/EXECUTION-STATUS.md`.
- Commits: Conventional Commits style, English, matching existing history (`feat:`, `refactor:`, `chore:`, `fix:`).
- Spec: `docs/superpowers/specs/2026-07-14-orders-workflow-design.md` — read it if any task instruction below seems to conflict with it; this plan implements it in full.

---

### Task 1: `lib/data/orderStatus.ts` — date formatting helpers + dead code removal

**Files:**
- Modify: `lib/data/orderStatus.ts`
- Create: `lib/data/orderStatus.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `formatOrderAgo(createdAt: Date, now?: Date): string`
  - `formatOrderDate(createdAt: Date, now?: Date): string`
  - `statusMeta` — unchanged, still exported.
  - `effStatus` — **removed** (confirmed zero callers anywhere in the codebase besides its own definition).

- [ ] **Step 1: Write the failing tests**

Create `lib/data/orderStatus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatOrderAgo, formatOrderDate } from "@/lib/data/orderStatus";

describe("formatOrderAgo", () => {
  const now = new Date("2026-07-14T10:00:00Z");

  it("returns \"à l'instant\" for less than a minute ago", () => {
    const createdAt = new Date("2026-07-14T09:59:30Z");
    expect(formatOrderAgo(createdAt, now)).toBe("à l'instant");
  });

  it("returns minutes for under an hour ago", () => {
    const createdAt = new Date("2026-07-14T09:48:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("il y a 12 min");
  });

  it("returns hours for under a day ago", () => {
    const createdAt = new Date("2026-07-14T07:00:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("il y a 3 h");
  });

  it("returns \"hier\" for exactly one day ago", () => {
    const createdAt = new Date("2026-07-13T10:00:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("hier");
  });

  it("returns days for more than a day ago", () => {
    const createdAt = new Date("2026-07-10T10:00:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("il y a 4 j");
  });
});

describe("formatOrderDate", () => {
  const now = new Date("2026-07-14T10:00:00Z");

  it("prefixes with \"Aujourd'hui\" for the same calendar day", () => {
    const createdAt = new Date("2026-07-14T09:42:00Z");
    expect(formatOrderDate(createdAt, now)).toContain("Aujourd'hui");
  });

  it("prefixes with \"Hier\" for the previous calendar day", () => {
    const createdAt = new Date("2026-07-13T18:20:00Z");
    expect(formatOrderDate(createdAt, now)).toContain("Hier");
  });

  it("falls back to a day/month date further in the past", () => {
    const createdAt = new Date("2026-07-01T11:40:00Z");
    const result = formatOrderDate(createdAt, now);
    expect(result).not.toContain("Aujourd'hui");
    expect(result).not.toContain("Hier");
    expect(result).toContain("01/07");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/data/orderStatus.test.ts`
Expected: FAIL — `formatOrderAgo`/`formatOrderDate` are not exported yet.

- [ ] **Step 3: Implement the formatters and remove dead code**

Replace the full contents of `lib/data/orderStatus.ts`:

```ts
import type { OrderStatus } from "./types";

/** Métadonnées d'affichage (badge) par statut de commande. */
export const statusMeta: Record<
  OrderStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  nouvelle: { label: "À valider", bg: "#FBF1D8", color: "#8a6500", dot: "#E0A400" },
  confirmee: { label: "Confirmée", bg: "#EEF0F7", color: "#26326B", dot: "#26326B" },
  preparation: { label: "En préparation", bg: "#FBF1D8", color: "#8a6500", dot: "#E0A400" },
  livree: { label: "Livrée", bg: "#E6F4EE", color: "#0b6e4d", dot: "#0E9F6E" },
  refusee: { label: "Refusée", bg: "#F8E5E3", color: "#9c352d", dot: "#C4453B" },
};

/** Ancienneté relative d'une commande, affichée dans les listes (« il y a 12 min », « hier »). */
export function formatOrderAgo(createdAt: Date, now: Date = new Date()): string {
  const diffMin = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  return `il y a ${diffD} j`;
}

/** Date/heure complète d'une commande, affichée dans le détail (« Aujourd'hui 09:42 », « Hier 18:20 »). */
export function formatOrderDate(createdAt: Date, now: Date = new Date()): string {
  const time = createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (createdAt.toDateString() === now.toDateString()) return `Aujourd'hui ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (createdAt.toDateString() === yesterday.toDateString()) return `Hier ${time}`;
  return `${createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${time}`;
}
```

(`effStatus` and its `Order` type import are gone — `statusMeta` only needs `OrderStatus`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/data/orderStatus.test.ts`
Expected: PASS, all 8 tests green.

Run: `npm run test`
Expected: same pass count as baseline plus these 8 new tests, 0 failures. (`effStatus` had zero callers — confirmed via `grep -rn "effStatus\b" .` before this task — so nothing else breaks.)

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/data/orderStatus.ts lib/data/orderStatus.test.ts
git commit -m "feat: add order date-formatting helpers, drop dead effStatus"
```

---

### Task 2: `lib/data/orders.server.ts` — Prisma reads

**Files:**
- Create: `lib/data/orders.server.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/client`, `getCurrentTenant` from `@/lib/tenant`, `formatOrderAgo`/`formatOrderDate` from `@/lib/data/orderStatus` (Task 1), `fmt`/`money` from `@/lib/format`, `Order`/`OrderLine` types from `@/lib/data/types`.
- Produces:
  - `getOrders(): Promise<Order[]>`
  - `getOrderByRef(ref: string): Promise<Order | null>`
  - `getPendingOrdersCount(): Promise<number>`

This file is additive only — nothing imports it yet, so it cannot break anything. Same client/server split discipline as `lib/data/catalog.server.ts` (sub-project 3): this file must never be imported by a `"use client"` component (it pulls in `next/headers` via `getCurrentTenant`).

- [ ] **Step 1: Create the file**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { fmt, money } from "@/lib/format";
import { formatOrderAgo, formatOrderDate } from "./orderStatus";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Order } from "./types";

type PrismaOrderWithLines = Prisma.OrderGetPayload<{ include: { lines: true } }>;

/** Convertit une commande Prisma (+ lignes) vers le type applicatif `Order`. */
function toOrder(row: PrismaOrderWithLines): Order {
  const items = row.lines.reduce((sum, l) => sum + l.qty, 0);
  return {
    id: row.ref,
    cid: row.customerId ?? "web",
    client: row.clientName,
    place: row.place,
    phone: row.phone,
    items,
    channel: row.channel,
    ago: formatOrderAgo(row.createdAt),
    date: formatOrderDate(row.createdAt),
    total: money(row.total),
    status: row.status,
    vip: row.vipAtOrder,
    lines: row.lines.map((l) => ({
      name: l.nameAtOrder,
      qty: l.qty,
      price: fmt(l.unitPrice),
      total: fmt(l.lineTotal),
      productId: l.productId,
    })),
  };
}

/** Lit toutes les commandes du tenant courant, les plus récentes d'abord. */
export async function getOrders(): Promise<Order[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.order.findMany({
    where: { tenantId: tenant.id },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toOrder);
}

/** Lit une commande par sa référence affichée (« #TER-XXXX »). `null` si absente. */
export async function getOrderByRef(ref: string): Promise<Order | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.order.findFirst({
    where: { ref, tenantId: tenant.id },
    include: { lines: true },
  });
  return row ? toOrder(row) : null;
}

/** Nombre de commandes encore « à valider » (statut `nouvelle`). */
export async function getPendingOrdersCount(): Promise<number> {
  const tenant = await getCurrentTenant();
  return prisma.order.count({ where: { tenantId: tenant.id, status: "nouvelle" } });
}
```

Note on the app `Order.id` field: throughout this codebase (mock and UI alike), `Order.id` has always held the display ref (e.g. `"#TER-0492"`), never a separate database primary key — `OrdersScreen`, `ConfirmView`, and every test already treat it that way. This mapping preserves that: `row.ref` (the Postgres-generated `"#TER-XXXX"` string) becomes `id`, and the real Prisma cuid (`row.id`) is not exposed to the app layer at all, since nothing needs it.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run test`
Expected: same pass count as after Task 1 (nothing imports this file yet).

- [ ] **Step 3: Commit**

```bash
git add lib/data/orders.server.ts
git commit -m "feat: add Prisma-backed order reads (getOrders, getOrderByRef, getPendingOrdersCount)"
```

---

### Task 3: `lib/orders/buildOrderLines.ts` + `lib/orders/actions.ts` — order construction + Server Actions

**Files:**
- Create: `lib/orders/buildOrderLines.ts`
- Create: `lib/orders/buildOrderLines.test.ts`
- Create: `lib/orders/actions.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/client`, `getCurrentTenant` from `@/lib/tenant`, `kycSchema`/`KycInput` from `@/lib/validators/kyc` (unchanged), `revalidatePath` from `next/cache`.
- Produces:
  - `buildOrderLines(cartLines, products): { ok: true; lines: OrderLineData[]; total: number } | { ok: false; error: string }` (pure, testable without a DB)
  - `submitWebOrder(kyc: KycInput, cartLines: WebCartLineInput[]): Promise<{ ok: true; ref: string } | { ok: false; error: string }>`
  - `confirmOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `rejectOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }>`

This task is additive only — nothing imports these files yet.

- [ ] **Step 1: Write the failing tests for the pure line-building logic**

Create `lib/orders/buildOrderLines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildOrderLines } from "@/lib/orders/buildOrderLines";

const PRODUCTS = [
  { id: "p1", name: "Foulard Wax Abidjan", price: 12500 },
  { id: "p9", name: "Broche dorée", price: 4500 },
];

describe("buildOrderLines", () => {
  it("builds lines and a total from server-side prices, ignoring any client price", () => {
    const result = buildOrderLines(
      [{ productId: "p1", qty: 2 }, { productId: "p9", qty: 1 }],
      PRODUCTS
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines).toEqual([
      { productId: "p1", nameAtOrder: "Foulard Wax Abidjan", qty: 2, unitPrice: 12500, lineTotal: 25000 },
      { productId: "p9", nameAtOrder: "Broche dorée", qty: 1, unitPrice: 4500, lineTotal: 4500 },
    ]);
    expect(result.total).toBe(29500);
  });

  it("fails cleanly if a cart line references an unknown product", () => {
    const result = buildOrderLines([{ productId: "nope", qty: 1 }], PRODUCTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("nope");
  });

  it("fails cleanly on a zero or negative quantity", () => {
    const result = buildOrderLines([{ productId: "p1", qty: 0 }], PRODUCTS);
    expect(result.ok).toBe(false);
  });

  it("fails cleanly on an empty cart", () => {
    const result = buildOrderLines([], PRODUCTS);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/orders/buildOrderLines.test.ts`
Expected: FAIL — `lib/orders/buildOrderLines.ts` does not exist yet.

- [ ] **Step 3: Implement the pure line-building logic**

Create `lib/orders/buildOrderLines.ts`:

```ts
export interface WebCartLineInput {
  productId: string;
  qty: number;
}

export interface PriceLookup {
  id: string;
  name: string;
  price: number;
}

export interface OrderLineData {
  productId: string;
  nameAtOrder: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Construit les lignes de commande et le total à partir de prix serveur —
 * jamais du prix envoyé par le client. `products` doit contenir un prix
 * actuel par `productId` (lu depuis Postgres par l'appelant).
 */
export function buildOrderLines(
  cartLines: WebCartLineInput[],
  products: PriceLookup[]
): { ok: true; lines: OrderLineData[]; total: number } | { ok: false; error: string } {
  if (cartLines.length === 0) {
    return { ok: false, error: "Le panier est vide." };
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: OrderLineData[] = [];
  for (const line of cartLines) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return { ok: false, error: "Quantité invalide." };
    }
    const product = byId.get(line.productId);
    if (!product) {
      return { ok: false, error: `Produit introuvable : ${line.productId}` };
    }
    lines.push({
      productId: product.id,
      nameAtOrder: product.name,
      qty: line.qty,
      unitPrice: product.price,
      lineTotal: product.price * line.qty,
    });
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { ok: true, lines, total };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/orders/buildOrderLines.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Implement the Server Actions**

Create `lib/orders/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { kycSchema, type KycInput } from "@/lib/validators/kyc";
import { buildOrderLines, type WebCartLineInput } from "./buildOrderLines";

export async function submitWebOrder(
  kyc: KycInput,
  cartLines: WebCartLineInput[]
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const parsedKyc = kycSchema.safeParse(kyc);
  if (!parsedKyc.success) {
    return { ok: false, error: "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, id: { in: cartLines.map((l) => l.productId) } },
      });
      const built = buildOrderLines(cartLines, products);
      if (!built.ok) throw new Error(built.error);

      return tx.order.create({
        data: {
          tenantId: tenant.id,
          clientName: parsedKyc.data.name,
          place: parsedKyc.data.place,
          phone: parsedKyc.data.phone,
          channel: "Web",
          total: built.total,
          lines: { create: built.lines },
        },
      });
    });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true, ref: order.ref };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known = message.startsWith("Produit introuvable") || message === "Quantité invalide." || message === "Le panier est vide.";
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}

export async function confirmOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { ref }, include: { lines: true } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "nouvelle") return; // idempotent : déjà traitée

      for (const line of order.lines) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product || product.stock < line.qty) {
          throw new Error(`Stock insuffisant pour ${line.nameAtOrder}.`);
        }
      }
      for (const line of order.lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.qty } },
        });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: "confirmee" } });
    });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/inventaire");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Une erreur est survenue, réessayez.";
    return { ok: false, error: message };
  }
}

export async function rejectOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const order = await prisma.order.findUnique({ where: { ref } });
    if (!order) return { ok: false, error: "Commande introuvable." };
    if (order.status === "nouvelle") {
      await prisma.order.update({ where: { id: order.id }, data: { status: "refusee" } });
    }
    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

Note: `kyc.note` and `kyc.wa` are validated by `kycSchema` but never persisted — the `Order` model has no columns for them. This matches the current mock exactly: `buildWebOrder` (being removed in Task 8) never used `kyc.note`/`kyc.wa` either. Not a regression introduced by this plan.

- [ ] **Step 6: Verify**

Run: `npm run test`
Expected: same pass count as after Task 2 plus the 4 new `buildOrderLines` tests, 0 failures.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/orders/buildOrderLines.ts lib/orders/buildOrderLines.test.ts lib/orders/actions.ts
git commit -m "feat: add order Server Actions (submitWebOrder, confirmOrder, rejectOrder)

Prices and totals are always recomputed from the current Postgres
Product row, never trusted from the client cart. submitWebOrder inserts
Order + OrderLine together in one transaction. confirmOrder checks
stock sufficiency for every line before deducting anything — all or
nothing, idempotent on an already-confirmed order."
```

---

### Task 4: Storefront checkout & confirmation

**Files:**
- Modify: `components/storefront/views/CheckoutView.tsx`
- Modify: `components/storefront/views/ConfirmView.tsx`
- Modify: `app/(storefront)/confirmation/page.tsx`

**Interfaces:**
- Consumes: `submitWebOrder` (Task 3), `getOrderByRef` (Task 2).
- Produces: `ConfirmView({ order: Order | null })` — no longer reads `useShop` or `useSearchParams` itself.

- [ ] **Step 1: `CheckoutView` calls the Server Action directly**

Replace `components/storefront/views/CheckoutView.tsx` in full:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { LoyaltyBadge } from "@/components/storefront/LoyaltyBadge";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { submitWebOrder } from "@/lib/orders/actions";
import { validateKyc, type KycFieldErrors } from "@/lib/validators/kyc";
import { cartSubtotal } from "@/lib/store/cartLogic";
import { money, fmt } from "@/lib/format";

export function CheckoutView() {
  const router = useRouter();
  const cart = useStorefront((s) => s.cart);
  const kyc = useStorefront((s) => s.kyc);
  const setKycField = useStorefront((s) => s.setKycField);
  const sending = useStorefront((s) => s.sending);
  const setSending = useStorefront((s) => s.setSending);
  const clearCart = useStorefront((s) => s.clearCart);
  const resetKyc = useStorefront((s) => s.resetKyc);

  const [errors, setErrors] = useState<KycFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const subtotal = cartSubtotal(cart);

  if (cart.length === 0) {
    return (
      <div className="ft-store-page" style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: colors.muted, marginBottom: 12 }}>Votre panier est vide.</p>
        <Link href="/catalogue" style={{ color: colors.primary, fontWeight: 600 }}>Découvrir la boutique →</Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    const result = validateKyc(kyc);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSending(true);

    const lines = cart.map((l) => ({ productId: l.productId, qty: l.qty }));
    const response = await submitWebOrder(result.data, lines);

    setSending(false);
    if (!response.ok) {
      setSubmitError(response.error);
      return;
    }
    clearCart();
    resetKyc();
    router.push(`/confirmation?ref=${encodeURIComponent(response.ref)}`);
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 860, margin: "0 auto" }}>
      <Breadcrumb items={[{ label: "Panier", href: "/panier" }, { label: "Ma demande" }]} />
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-.01em" }}>
        Envoyer ma demande
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 22px" }}>
        Quelques informations et c&apos;est parti — aucun paiement maintenant.
      </p>

      <div className="ft-store-checkout-layout" style={{ display: "grid", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: colors.bgInfo, borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
            <Icon path={ICONS.info} size={20} stroke={colors.primary} strokeWidth={1.75} style={{ flex: "none" }} />
            <span style={{ fontSize: 13.5, color: colors.primary, fontWeight: 500, lineHeight: 1.45 }}>
              La gérante vous contactera pour confirmer votre commande, le mode de livraison et le paiement.
            </span>
          </div>

          {submitError && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F8E5E3", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
              <Icon path={ICONS.info} size={20} stroke="#9c352d" strokeWidth={1.75} style={{ flex: "none" }} />
              <span style={{ fontSize: 13.5, color: "#9c352d", fontWeight: 500, lineHeight: 1.45 }}>{submitError}</span>
            </div>
          )}

          <Field label="Nom complet *" error={errors.name}>
            <input value={kyc.name} onChange={(e) => setKycField("name", e.target.value)} placeholder="Ex. Aya Koffi" style={inputStyle(!!errors.name)} />
          </Field>
          <Field label="Lieu de livraison *" error={errors.place}>
            <input value={kyc.place} onChange={(e) => setKycField("place", e.target.value)} placeholder="Ex. Plateau, Abidjan — quartier / repère" style={inputStyle(!!errors.place)} />
          </Field>
          <Field label="Numéro de contact *" error={errors.phone}>
            <input value={kyc.phone} onChange={(e) => setKycField("phone", e.target.value)} placeholder="Ex. +225 07 12 45 67 89" style={inputStyle(!!errors.phone)} />
          </Field>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>Note (optionnel)</label>
            <textarea
              value={kyc.note}
              onChange={(e) => setKycField("note", e.target.value)}
              placeholder="Une précision sur votre commande…"
              style={{ width: "100%", height: 80, padding: "12px 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `400 15px ${fonts.ui}`, color: colors.ink, outline: "none", resize: "none" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 22 }}>
            <span
              onClick={() => setKycField("wa", !kyc.wa)}
              style={{ width: 44, height: 26, borderRadius: 999, background: kyc.wa ? colors.success : colors.borderField, position: "relative", flex: "none" }}
            >
              <span style={{ position: "absolute", top: 3, left: kyc.wa ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s" }} />
            </span>
            <span style={{ fontSize: 14 }}>Être recontactée par WhatsApp</span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={sending}
            style={{ width: "100%", height: 52, border: "none", borderRadius: 10, background: colors.accent, color: "#fff", font: `700 16px ${fonts.ui}`, cursor: sending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {sending && <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block", animation: "ft-spin .7s linear infinite" }} />}
            {sending ? "Envoi…" : "Envoyer ma demande"}
          </button>
        </div>

        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: 22 }}>
          <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 16 }}>Votre demande</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {cart.map((line) => (
              <div key={line.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 54, flex: "none", borderRadius: 8, background: stripe(line.colorHex) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `600 13.5px ${fonts.ui}`, lineHeight: 1.2 }}>{line.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>× {line.qty} · {line.variant}</div>
                </div>
                <div style={{ font: `700 13.5px ${fonts.ui}`, color: colors.primary }}>{fmt(line.price * line.qty)}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "#EAE4D9", marginBottom: 14 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: `600 14px ${fonts.ui}` }}>Total estimé</span>
            <span style={{ font: `700 20px ${fonts.ui}`, color: colors.primary }}>{money(subtotal)}</span>
          </div>
          <LoyaltyBadge points={Math.round(subtotal / 500)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>{label}</label>
      {children}
      {error && <p style={{ font: `500 12.5px ${fonts.ui}`, color: "#9c352d", margin: "7px 0 0" }}>{error}</p>}
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%", height: 48, padding: "0 14px",
    border: `1.5px solid ${hasError ? colors.danger : colors.borderField}`,
    borderRadius: 10, background: "#fff", font: `400 15px ${fonts.ui}`, color: colors.ink, outline: "none",
  };
}
```

Note: the 600ms artificial `setTimeout` is gone — the real network round-trip to the Server Action already provides perceived latency, and `sending` now brackets the real `await`.

- [ ] **Step 2: `ConfirmView` receives the order as a prop**

Replace `components/storefront/views/ConfirmView.tsx` in full:

```tsx
"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import type { Order } from "@/lib/data/types";

const STEPS = [
  { title: "En attente de confirmation", desc: "Nous avons bien reçu votre demande." },
  { title: "Confirmée", desc: "La gérante valide la disponibilité et le prix." },
  { title: "En préparation", desc: "Vos articles sont emballés avec soin." },
  { title: "Livrée", desc: "Remise en main propre ou par livreur." },
];

export function ConfirmView({ order }: { order: Order | null }) {
  if (!order) {
    return (
      <div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: colors.muted, marginBottom: 12 }}>Commande introuvable.</p>
        <Link href="/catalogue" style={{ color: colors.primary, fontWeight: 600 }}>Découvrir la boutique →</Link>
      </div>
    );
  }

  return (
    <div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="ft-store-conf-pad" style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: "#E6F4EE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon path={ICONS.check} size={32} stroke={colors.success} strokeWidth={2} />
        </div>
        <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-.01em" }}>
          Demande envoyée !
        </h1>
        <p style={{ fontSize: 15, color: colors.muted, margin: "0 auto 6px", maxWidth: 420, lineHeight: 1.55 }}>
          Merci {order.client}. La gérante vous contactera très vite pour confirmer votre commande.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, font: `600 13px ${fonts.ui}`, color: colors.primary, background: colors.bgInfo, padding: "6px 14px", borderRadius: 999, marginTop: 8 }}>
          Commande {order.id}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px", marginTop: 16 }}>
        <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 22 }}>Suivi de la demande</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {STEPS.map((step, i) => {
            const active = i === 0;
            const last = i === STEPS.length - 1;
            return (
              <div key={step.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 999, background: active ? colors.success : "#F1ECE2", display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#fff" : "#9a8f7d", font: `700 13px ${fonts.ui}` }}>
                    {active ? "●" : i + 1}
                  </span>
                  {!last && <span style={{ width: 2, height: 26, background: "#EAE4D9" }} />}
                </div>
                <div style={{ paddingBottom: last ? 0 : 18 }}>
                  <div style={{ font: `600 14.5px ${fonts.ui}`, color: active ? colors.ink : "#9a8f7d" }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <a href="#" style={{ flex: 1, minWidth: 180, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 50, borderRadius: 10, background: colors.success, color: "#fff", font: `700 15px ${fonts.ui}` }}>
          <Icon path={ICONS.whatsapp} size={20} stroke="#fff" strokeWidth={1.75} />
          Suivre sur WhatsApp
        </a>
        <Link href="/compte" style={{ flex: 1, minWidth: 180, height: 50, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Voir mes commandes
        </Link>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/catalogue" style={{ font: `600 14px ${fonts.ui}`, color: colors.primary }}>
          Continuer mes achats →
        </Link>
      </div>
    </div>
  );
}
```

(`useSearchParams`/`useShop` are gone — `ConfirmView` is now a pure presentational consumer of the `order` prop, with a real "commande introuvable" state instead of the old fake `#TER-0000` fallback.)

- [ ] **Step 3: `confirmation/page.tsx` reads `?ref=` server-side**

Replace `app/(storefront)/confirmation/page.tsx` in full:

```tsx
import { getOrderByRef } from "@/lib/data/orders.server";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const order = ref ? await getOrderByRef(ref) : null;
  return <ConfirmView order={order} />;
}
```

`Suspense` is no longer needed here — `ConfirmView` has no client-side `useSearchParams()` call left to require it (the page itself reads `searchParams` server-side, the standard, no-Suspense-needed way in the App Router).

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors in these 3 files. (Other `useShop` consumers — `OrdersScreen`, `DashboardScreen`, the 5 product-stock files — are untouched by this task and keep working exactly as before; `useShop.ts` itself is not modified or deleted yet.)

Run: `npm run test`
Expected: same pass count as after Task 3 (no test covers these UI files directly).

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/CheckoutView.tsx components/storefront/views/ConfirmView.tsx "app/(storefront)/confirmation/page.tsx"
git commit -m "feat: submit and confirm web orders through real Server Actions"
```

---

### Task 5: Back-office orders screen — validate/refuse for real, drop the auto-validate toggle

**Files:**
- Modify: `components/dashboard/screens/OrdersScreen.tsx`
- Modify: `app/(dashboard)/commandes/page.tsx`

**Interfaces:**
- Consumes: `getOrders` (Task 2), `confirmOrder`/`rejectOrder` (Task 3).
- Produces: `OrdersScreen({ orders: Order[]; initialSel?: string })`.

- [ ] **Step 1: `OrdersScreen` reads orders from props and calls the real actions**

In `components/dashboard/screens/OrdersScreen.tsx`:

Old imports/signature:
```tsx
import { statusMeta } from "@/lib/data/orderStatus";
import { computeEffectiveStatus } from "@/lib/store/shopLogic";
import { initials } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { useShop } from "@/lib/store/useShop";
import type { Order, OrderStatus } from "@/lib/data/types";
```
```tsx
export function OrdersScreen({ initialSel }: { initialSel?: string }) {
  const [filter, setFilter] = useState<string>("toValidate");
  const [selId, setSelId] = useState<string | null>(initialSel ?? null);

  const orders = useShop((s) => s.orders);
  const overrides = useShop((s) => s.statusOverrides);
  const autoValidate = useShop((s) => s.autoValidate);
  const toggleAuto = useShop((s) => s.toggleAuto);
  const confirmOrder = useShop((s) => s.confirmOrder);
  const rejectOrder = useShop((s) => s.rejectOrder);
  const showToast = useBackoffice((s) => s.showToast);

  const cur = FILTERS.find((f) => f[0] === filter)!;
  const list = orders.filter((o) => (filter === "all" ? true : computeEffectiveStatus(o, overrides) === cur[2]));

  const selected: Order | undefined =
    orders.find((o) => o.id === selId) ?? list[0] ?? orders[0];

  const count = (st: OrderStatus | null) =>
    st === null ? orders.length : orders.filter((o) => computeEffectiveStatus(o, overrides) === st).length;
```

New:
```tsx
import { statusMeta } from "@/lib/data/orderStatus";
import { initials } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { confirmOrder, rejectOrder } from "@/lib/orders/actions";
import type { Order, OrderStatus } from "@/lib/data/types";
```
```tsx
export function OrdersScreen({ orders, initialSel }: { orders: Order[]; initialSel?: string }) {
  const [filter, setFilter] = useState<string>("toValidate");
  const [selId, setSelId] = useState<string | null>(initialSel ?? null);

  const showToast = useBackoffice((s) => s.showToast);

  const cur = FILTERS.find((f) => f[0] === filter)!;
  const list = orders.filter((o) => (filter === "all" ? true : o.status === cur[2]));

  const selected: Order | undefined =
    orders.find((o) => o.id === selId) ?? list[0] ?? orders[0];

  const count = (st: OrderStatus | null) =>
    st === null ? orders.length : orders.filter((o) => o.status === st).length;
```

- [ ] **Step 2: Remove the "Validation auto" toggle**

Old (the whole info banner, including the toggle):
```tsx
      {/* info banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#EEF0F7",
          border: "1px solid #d4dbf0",
          borderRadius: 12,
          padding: "11px 15px",
          marginBottom: 16,
          fontSize: 13,
          color: colors.primary,
        }}
      >
        <Icon path={ICONS.info} size={18} stroke={colors.primary} strokeWidth={1.8} style={{ flex: "none" }} />
        <span style={{ flex: 1 }}>
          Le stock n&apos;est déduit qu&apos;à la <strong>validation</strong> d&apos;une commande.{" "}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flex: "none" }}>
          <span style={{ fontWeight: 600, fontSize: 12.5 }}>Validation auto</span>
          <span
            onClick={toggleAuto}
            style={{
              width: 44,
              height: 26,
              borderRadius: 999,
              position: "relative",
              background: autoValidate ? colors.success : colors.borderField,
              transition: "background .15s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,.2)",
                transition: "left .15s",
                left: autoValidate ? 21 : 3,
              }}
            />
          </span>
        </label>
      </div>
```

New (info text only):
```tsx
      {/* info banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#EEF0F7",
          border: "1px solid #d4dbf0",
          borderRadius: 12,
          padding: "11px 15px",
          marginBottom: 16,
          fontSize: 13,
          color: colors.primary,
        }}
      >
        <Icon path={ICONS.info} size={18} stroke={colors.primary} strokeWidth={1.8} style={{ flex: "none" }} />
        <span style={{ flex: 1 }}>
          Le stock n&apos;est déduit qu&apos;à la <strong>validation</strong> d&apos;une commande.
        </span>
      </div>
```

- [ ] **Step 3: Replace remaining `computeEffectiveStatus` reads with the real `status` field**

Old:
```tsx
            list.map((o) => {
              const st = statusMeta[computeEffectiveStatus(o, overrides)];
```

New:
```tsx
            list.map((o) => {
              const st = statusMeta[o.status];
```

- [ ] **Step 4: `onValidate`/`onRefuse` call the real Server Actions**

Old:
```tsx
            <OrderDetail
              order={selected}
              status={computeEffectiveStatus(selected, overrides)}
              onValidate={() => {
                confirmOrder(selected.id);
                showToast("Commande validée — stock déduit", "success");
              }}
              onRefuse={() => {
                rejectOrder(selected.id);
                showToast("Commande refusée", "error");
              }}
              onEdit={() => showToast("Édition de la commande…", "success")}
            />
```

New:
```tsx
            <OrderDetail
              order={selected}
              status={selected.status}
              onValidate={async () => {
                const result = await confirmOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande validée — stock déduit", "success");
              }}
              onRefuse={async () => {
                const result = await rejectOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande refusée", "error");
              }}
              onEdit={() => showToast("Édition de la commande…", "success")}
            />
```

(`confirmOrder`/`rejectOrder` here are the imported Server Actions from Step 1, called with `selected.id` — which holds the `"#TER-XXXX"` ref, exactly the `ref` parameter these actions expect. No other change needed — `OrderDetail`'s own internals already take `status`/`onValidate`/`onRefuse`/`onEdit` as plain props and don't care where they came from.)

- [ ] **Step 5: `commandes/page.tsx` fetches orders server-side**

Replace `app/(dashboard)/commandes/page.tsx` in full:

```tsx
import { getOrders } from "@/lib/data/orders.server";
import { OrdersScreen } from "@/components/dashboard/screens/OrdersScreen";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ sel?: string }>;
}) {
  const { sel } = await searchParams;
  const orders = await getOrders();
  return <OrdersScreen orders={orders} initialSel={sel} />;
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: no errors in these 2 files.

Run: `npm run test`
Expected: same pass count as after Task 4.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/screens/OrdersScreen.tsx "app/(dashboard)/commandes/page.tsx"
git commit -m "feat: validate and reject orders through real Server Actions

Drops the \"Validation auto\" toggle — it was wired but inert since
Plan 2, with no defined business rule, and would bypass the central
CLAUDE.md workflow (the manager always contacts the customer before
confirming)."
```

---

### Task 6: Dashboard screen — real orders and stock

**Files:**
- Modify: `components/dashboard/screens/DashboardScreen.tsx`
- Modify: `app/(dashboard)/tableau-de-bord/page.tsx`

**Interfaces:**
- Consumes: `getCatalog` (sub-project 3, unchanged), `getOrders` (Task 2).
- Produces: `DashboardScreen({ products: Product[]; orders: Order[] })`.

- [ ] **Step 1: `DashboardScreen` reads orders from props, drops `computeEffectiveStock`**

In `components/dashboard/screens/DashboardScreen.tsx`:

Old:
```tsx
import type { Product } from "@/lib/data/types";
import { computeEffectiveStatus, computeEffectiveStock } from "@/lib/store/shopLogic";
import { money } from "@/lib/format";
import { initials } from "@/lib/format";
import { useShop } from "@/lib/store/useShop";
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
  const nouvelles = orders.filter((o) => computeEffectiveStatus(o, overrides) === "nouvelle");
  const toValidate = nouvelles.slice(0, 3);
```

New:
```tsx
import type { Order, Product } from "@/lib/data/types";
import { money } from "@/lib/format";
import { initials } from "@/lib/format";
```
```tsx
export function DashboardScreen({ products, orders }: { products: Product[]; orders: Order[] }) {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [range, setRange] = useState<"7" | "30">("7");
```
```tsx
  const lowStockAlerts = products.filter((p) => p.stock <= 9);
  const lowStock = lowStockAlerts.slice(0, 4);
  const lowStockCount = lowStockAlerts.length;
  const nouvelles = orders.filter((o) => o.status === "nouvelle");
  const toValidate = nouvelles.slice(0, 3);
```

- [ ] **Step 2: The low-stock render loop reads `s.stock` instead of the removed `s.effectiveStock`**

Old:
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

New:
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

- [ ] **Step 3: `tableau-de-bord/page.tsx` fetches both products and orders**

Replace `app/(dashboard)/tableau-de-bord/page.tsx` in full:

```tsx
import { getCatalog } from "@/lib/data/catalog.server";
import { getOrders } from "@/lib/data/orders.server";
import { DashboardScreen } from "@/components/dashboard/screens/DashboardScreen";

export default async function DashboardPage() {
  const [products, orders] = await Promise.all([getCatalog(), getOrders()]);
  return <DashboardScreen products={products} orders={orders} />;
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors in these 2 files.

Run: `npm run test`
Expected: same pass count as after Task 5.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/screens/DashboardScreen.tsx "app/(dashboard)/tableau-de-bord/page.tsx"
git commit -m "feat: source Dashboard's low-stock and pending-orders cards from Postgres"
```

---

### Task 7: Drop `computeEffectiveStock` from the remaining 5 product-stock displays

**Files:**
- Modify: `components/storefront/blocks/ProductGridBlock.tsx`
- Modify: `components/storefront/blocks/FeaturedProductBlock.tsx`
- Modify: `components/storefront/views/CatalogView.tsx`
- Modify: `components/storefront/views/ProductView.tsx`
- Modify: `components/dashboard/screens/InventoryScreen.tsx`

**Interfaces:**
- Consumes: nothing new — this task only removes the now-pointless indirection through `computeEffectiveStock`/`useShop`, reading `product.stock` directly (already the real, current Postgres value since sub-project 3; there is no more session-local deduction overlay to subtract, since `confirmOrder` (Task 3) now decrements `Product.stock` for real).
- Produces: none of these 5 files import `useShop` or `shopLogic` anymore after this task.

- [ ] **Step 1: `ProductGridBlock.tsx`**

Old:
```tsx
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
```
```tsx
                stock={computeEffectiveStock(p.id, p.stock, stockDeductions)}
```

New:
```tsx
import { newestProducts } from "@/lib/data/catalog";
import { useStorefront } from "@/lib/store/useStorefront";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";
import { BlockFrame } from "./BlockFrame";

export function ProductGridBlock({ products = [] }: { products?: Product[] }) {
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
  const featured = newestProducts(products, 4);
```
```tsx
                stock={p.stock}
```

- [ ] **Step 2: `FeaturedProductBlock.tsx`**

Old:
```tsx
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
```

New:
```tsx
import { featuredProduct } from "@/lib/data/catalog";
import { useStorefront } from "@/lib/store/useStorefront";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";
import { BlockFrame } from "./BlockFrame";

export function FeaturedProductBlock({ products = [] }: { products?: Product[] }) {
  const product = featuredProduct(products);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  if (!product) return null;

  const stock = product.stock;
```

- [ ] **Step 3: `CatalogView.tsx`**

Old:
```tsx
import { filterCatalog, categories, type CatalogFilters } from "@/lib/data/catalog";
import { useShop } from "@/lib/store/useShop";
import { useStorefront } from "@/lib/store/useStorefront";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
```
```tsx
  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
```
```tsx
                  stock={computeEffectiveStock(p.id, p.stock, stockDeductions)}
```

New:
```tsx
import { filterCatalog, categories, type CatalogFilters } from "@/lib/data/catalog";
import { useStorefront } from "@/lib/store/useStorefront";
```
```tsx
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
```
```tsx
                  stock={p.stock}
```

- [ ] **Step 4: `ProductView.tsx`**

Old:
```tsx
import { useShop } from "@/lib/store/useShop";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
import { useStorefront } from "@/lib/store/useStorefront";
```
```tsx
  const stockDeductions = useShop((s) => s.stockDeductions);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const stock = computeEffectiveStock(product.id, product.stock, stockDeductions);
```
and, further down, in the "Vous aimerez aussi" loop:
```tsx
                stock={computeEffectiveStock(p.id, p.stock, stockDeductions)}
```

New:
```tsx
import { useStorefront } from "@/lib/store/useStorefront";
```
```tsx
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const stock = product.stock;
```
```tsx
                stock={p.stock}
```

- [ ] **Step 5: `InventoryScreen.tsx`**

Old:
```tsx
import { useShop } from "@/lib/store/useShop";
import { computeEffectiveStock } from "@/lib/store/shopLogic";
```
```tsx
export function InventoryScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const stockDeductions = useShop((s) => s.stockDeductions);
```
```tsx
                const s1 = computeEffectiveStock(p.id, p.stock, stockDeductions);
```
(table row) and, in `EditDrawer`:
```tsx
function EditDrawer({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const stockDeductions = useShop((s) => s.stockDeductions);
  const s1 = computeEffectiveStock(p.id, p.stock, stockDeductions);
```

New:
```tsx
```
(both imports removed — the file no longer imports `useShop` or `computeEffectiveStock` at all)
```tsx
export function InventoryScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
```
```tsx
                const s1 = p.stock;
```
```tsx
function EditDrawer({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const s1 = p.stock;
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: no errors in these 5 files.

Run: `npm run test`
Expected: same pass count as after Task 6.

Run: `grep -rn "useShop\|computeEffectiveStock" components/storefront components/dashboard`
Expected: no output — confirms these 5 files (plus everything migrated in Tasks 4-6) no longer reference either.

- [ ] **Step 7: Commit**

```bash
git add components/storefront/blocks/ProductGridBlock.tsx components/storefront/blocks/FeaturedProductBlock.tsx components/storefront/views/CatalogView.tsx components/storefront/views/ProductView.tsx components/dashboard/screens/InventoryScreen.tsx
git commit -m "refactor: read product stock directly, drop the deduction-overlay indirection

computeEffectiveStock existed to subtract a session-local deduction
overlay (useShop.stockDeductions) from a base stock. That overlay is
gone now that confirmOrder decrements Product.stock for real — the
displayed stock is already the effective one."
```

---

### Task 8: Sidebar/MobileNav badge, final deletion of the simulation layer

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `components/dashboard/Sidebar.tsx`
- Modify: `components/dashboard/MobileNav.tsx`
- Delete: `lib/store/useShop.ts`
- Delete: `lib/store/useNewOrdersCount.ts`
- Delete: `lib/data/orders.ts`
- Delete: `lib/store/shopLogic.ts`
- Delete: `lib/store/shopLogic.test.ts`

**Interfaces:**
- Consumes: `getPendingOrdersCount` (Task 2).
- Produces: `Sidebar({ session, pendingCount: number })`, `MobileNav({ pendingCount: number })` — this is the last task touching any of these files, and the point where the whole simulation layer is confirmed dead and removed.

- [ ] **Step 1: `app/(dashboard)/layout.tsx` fetches the pending count**

Old:
```tsx
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--color-ivory)",
        color: "var(--color-ink)",
      }}
    >
      <Sidebar session={session} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <OfflineBanner />
        <TopBar />
        <main className="ft-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </main>
        <MobileNav />
      </div>

      <Toast />
      <TicketModal />
    </div>
  );
}
```

New:
```tsx
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { getSession } from "@/lib/auth";
import { getPendingOrdersCount } from "@/lib/data/orders.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, pendingCount] = await Promise.all([getSession(), getPendingOrdersCount()]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--color-ivory)",
        color: "var(--color-ink)",
      }}
    >
      <Sidebar session={session} pendingCount={pendingCount} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <OfflineBanner />
        <TopBar />
        <main className="ft-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </main>
        <MobileNav pendingCount={pendingCount} />
      </div>

      <Toast />
      <TicketModal />
    </div>
  );
}
```

- [ ] **Step 2: `Sidebar.tsx` receives the count as a prop**

Old:
```tsx
import { useBackoffice } from "@/lib/store/useBackoffice";
import { useNewOrdersCount } from "@/lib/store/useNewOrdersCount";
import { initials } from "@/lib/format";
import { signOut } from "@/lib/auth/actions";
import type { Session } from "@/lib/auth";
```
```tsx
export function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const offline = useBackoffice((s) => s.offline);
  const toggleOffline = useBackoffice((s) => s.toggleOffline);
  const ordersBadge = useNewOrdersCount();
```
```tsx
          const badge = n.ordersBadge ? ordersBadge : 0;
```

New:
```tsx
import { useBackoffice } from "@/lib/store/useBackoffice";
import { initials } from "@/lib/format";
import { signOut } from "@/lib/auth/actions";
import type { Session } from "@/lib/auth";
```
```tsx
export function Sidebar({ session, pendingCount }: { session: Session | null; pendingCount: number }) {
  const pathname = usePathname();
  const offline = useBackoffice((s) => s.offline);
  const toggleOffline = useBackoffice((s) => s.toggleOffline);
```
```tsx
          const badge = n.ordersBadge ? pendingCount : 0;
```

- [ ] **Step 3: `MobileNav.tsx` receives the count as a prop**

Old:
```tsx
import { useBackoffice } from "@/lib/store/useBackoffice";
import { useNewOrdersCount } from "@/lib/store/useNewOrdersCount";
```
```tsx
export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const moreOpen = useBackoffice((s) => s.moreOpen);
  const openMore = useBackoffice((s) => s.openMore);
  const closeMore = useBackoffice((s) => s.closeMore);
  const ordersBadge = useNewOrdersCount();
```
```tsx
          const badge = t.ordersBadge ? ordersBadge : 0;
```

New:
```tsx
import { useBackoffice } from "@/lib/store/useBackoffice";
```
```tsx
export function MobileNav({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const moreOpen = useBackoffice((s) => s.moreOpen);
  const openMore = useBackoffice((s) => s.openMore);
  const closeMore = useBackoffice((s) => s.closeMore);
```
```tsx
          const badge = t.ordersBadge ? pendingCount : 0;
```

- [ ] **Step 4: Delete the simulation layer**

```bash
git rm lib/store/useShop.ts lib/store/useNewOrdersCount.ts lib/data/orders.ts lib/store/shopLogic.ts lib/store/shopLogic.test.ts
```

These five files have zero remaining importers after Tasks 4-7 migrated every consumer (`CheckoutView`, `ConfirmView`, `OrdersScreen`, `DashboardScreen`, `ProductGridBlock`, `FeaturedProductBlock`, `CatalogView`, `ProductView`, `InventoryScreen`) plus this task's `Sidebar`/`MobileNav`/layout change.

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: **zero errors anywhere in the project.**

Run: `npm run test`
Expected: all tests pass, 0 failures.

Run: `grep -rln "useShop\|shopLogic\|useNewOrdersCount\|lib/data/orders\"" app components lib --include="*.ts" --include="*.tsx"`
Expected: no output — confirms no file anywhere still imports any of the five deleted modules. (This pattern intentionally excludes `lib/data/orders.server`, which is a different, still-existing file — the trailing `"` in `lib/data/orders\"` only matches the exact bare import path.)

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/layout.tsx" components/dashboard/Sidebar.tsx components/dashboard/MobileNav.tsx
git commit -m "feat: source the sidebar/mobile-nav order badge from Postgres

Deletes lib/store/useShop.ts, lib/store/useNewOrdersCount.ts,
lib/data/orders.ts, lib/store/shopLogic.ts and its test file — the
entire client-side order/stock simulation layer, now fully replaced
by real Server Actions and Prisma reads across Tasks 3-7."
```

---

### Task 9: Whole-branch verification

**Files:** none (verification only).

**Interfaces:** none — this task validates the sub-project's success criteria (spec §7) end to end, including the real click-through the plan's own tests cannot cover.

- [ ] **Step 1: Full automated suite**

Run: `npm run test`
Expected: all tests pass.

Run: `npm run typecheck`
Expected: no errors.

Run: `npx next build --webpack`
Expected: builds successfully, no client/server boundary errors (watch specifically for a `next/headers`-in-client-bundle error of the same shape sub-project 3 hit — `lib/data/orders.server.ts` and `lib/orders/actions.ts` must never end up imported by a `"use client"` file; if the build fails this way, find the offending import and fix it before proceeding, the same way sub-project 3's Task 10 did).

- [ ] **Step 2: Data cross-check against the database**

Run via the Supabase MCP (`mcp__supabase__execute_sql`):
```sql
select count(*) from "Order" where "tenantId" = 'foulard-teranga';
```
Expected: `7` (the original 7 seeded mock orders — this task creates no new data by itself; Step 3 below will add one).

- [ ] **Step 3: Live browser walkthrough — the real end-to-end click-through**

Using the dev server (`next dev --webpack`), perform the actual flow a customer and the manager would:

1. `/catalogue` — add a product to the cart (note its name, price, and current stock from `/admin/inventaire` first).
2. `/panier` → `/commander` — fill the KYC form (name, place, phone) and submit.
3. Confirm redirect to `/confirmation?ref=...` shows the real order ref and customer name (not the old `#TER-0000` placeholder).
4. `/admin/commandes` — the new order appears in the "À valider" list with the correct customer name, item count, and total.
5. Click the order, click "Valider" — confirms without error, toast shows "Commande validée — stock déduit".
6. `/admin/inventaire` — the product's "Interne" stock is now lower by the ordered quantity, matching what was noted in Step 1.
7. `/admin/tableau-de-bord` — the order no longer appears in "Commandes à valider" (now confirmed); the low-stock alert reflects the new stock level if it dropped below the threshold.
8. Sidebar/mobile-nav order badge count decreased by 1 after the validation (reload the page — no Realtime, so a navigation/refresh is expected to be needed, per this sub-project's scope).
9. Repeat steps 1-4 with a second order, then click "Refuser" instead of "Valider" — order moves to "Refusées", stock is unchanged.
10. Attempt to validate an order for a product whose stock is now below the ordered quantity (edit `Product.stock` directly via `execute_sql` to force this, or place a large-quantity order) — confirm it fails with a clear inline error ("Stock insuffisant pour ...") and the order stays "À valider", stock unchanged.
11. Try submitting the checkout form with the browser's dev tools open and the cart's `localStorage` price manually edited to a lower value before submitting — confirm the resulting order's total in `/admin/commandes` reflects the real Postgres price, not the tampered one.

Any mismatch here is a real bug — stop and fix it (with a fresh unit test if the bug is in `buildOrderLines`, otherwise a direct fix + re-verification of the affected step) before considering this sub-project done, per `superpowers:verification-before-completion`. This is the first sub-project in this migration where a full real click-through is actually possible — prior sub-projects deferred parts of this to the user for lack of working browser tooling at the time; this plan's task explicitly requires doing it now if tooling is available.

- [ ] **Step 4: No commit**

This task produces no code changes unless Step 3 finds a bug — if it does, fix it as its own small commit before re-running this task's checklist from Step 1.
