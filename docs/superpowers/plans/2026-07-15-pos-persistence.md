# POS Sale Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `encaisser()` (POS "Encaisser" button) write a real, persisted sale instead of manipulating only in-memory client state.

**Architecture:** A new Server Action `encaisserVente()` (`lib/pos/actions.ts`) creates an `Order`+`OrderLine[]` already finalized (`channel: "Boutique"`, `status: "livree"`), in one Prisma `Serializable` transaction that also checks/decrements stock and updates customer loyalty — mirroring the existing `confirmOrder` pattern. Shared logic (price/discount computation, stock aggregation, loyalty upsert) is extracted into small reusable modules so `confirmOrder` and `encaisserVente` both call the same tested code instead of duplicating it.

**Tech Stack:** Next.js Server Actions, Prisma (`lib/db/client.ts`), Zod validators, Zustand (`useBackoffice`), Vitest.

## Global Constraints

- Never trust a price or discount amount sent from the client — always recompute from the server-side product price (spec §3.2).
- Server Actions always return `{ok, ...}`, never let an exception escape uncaught (spec §4, matches existing `confirmOrder`/`submitWebOrder` convention).
- `confirmOrder`'s existing behavior (idempotence, stock-insufficient error, customer create/match logic) must stay byte-for-byte identical after the refactor in Task 4 — verified via existing manual/browser flow, not just typecheck.
- No new RLS policy needed (spec §3.1) — `orders_update_staff`/`order_lines_*` already cover these columns.
- Full spec: `docs/superpowers/specs/2026-07-15-pos-persistence-design.md`.

---

### Task 1: Schema migration — `PaymentMethod` enum, `Order.paymentMethod`, `OrderLine.discount`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260715100000_pos_payment_and_discount/migration.sql`

**Interfaces:**
- Produces: Prisma Client fields `Order.paymentMethod: PaymentMethod | null`, `OrderLine.discount: number`, enum `PaymentMethod = "espece" | "mm" | "mixte"` — consumed by Tasks 2, 4, 5.

- [ ] **Step 1: Add the enum and fields to `prisma/schema.prisma`**

Add this enum near the other enums (after `enum NotificationType { ... }`, around line 48):

```prisma
enum PaymentMethod {
  espece
  mm
  mixte
}
```

In `model Order`, add one field right after `channel OrderChannel`:

```prisma
model Order {
  id            String        @id @default(cuid())
  tenantId      String
  ref           String        @unique @default(dbgenerated("('#TER-' || nextval('orders_ref_seq'))"))
  customerId    String?
  clientName    String
  place         String
  phone         String
  channel       OrderChannel
  paymentMethod PaymentMethod?
  status        OrderStatus   @default(nouvelle)
  vipAtOrder    Boolean       @default(false)
  total         Int
  createdAt     DateTime      @default(now())

  tenant   Tenant      @relation(fields: [tenantId], references: [id])
  customer Customer?   @relation(fields: [customerId], references: [id])
  lines    OrderLine[]

  @@index([tenantId])
}
```

In `model OrderLine`, add `discount` right after `unitPrice`:

```prisma
model OrderLine {
  id          String @id @default(cuid())
  orderId     String
  productId   String
  nameAtOrder String
  qty         Int
  unitPrice   Int
  discount    Int    @default(0)
  lineTotal   Int

  order   Order   @relation(fields: [orderId], references: [id])
  product Product @relation(fields: [productId], references: [id])

  @@index([orderId])
  @@index([productId])
}
```

- [ ] **Step 2: Apply the migration to the live database**

Use the `mcp__supabase__apply_migration` tool (not `prisma migrate dev` — no local shadow DB reachable, established convention, see `docs/superpowers/plans/2026-07-13-supabase-db-foundation.md`):

```sql
create type "PaymentMethod" as enum ('espece', 'mm', 'mixte');
alter table "Order" add column "paymentMethod" "PaymentMethod";
alter table "OrderLine" add column "discount" integer not null default 0;
```

name: `pos_payment_and_discount`

- [ ] **Step 3: Save the applied SQL to the migrations folder**

Create `prisma/migrations/20260715100000_pos_payment_and_discount/migration.sql` with the exact SQL from Step 2.

- [ ] **Step 4: Regenerate the Prisma Client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (7.8.0) to ./lib/generated/prisma`

- [ ] **Step 5: Verify the new columns are readable**

Run (via `mcp__supabase__execute_sql`): `select "paymentMethod" from "Order" limit 1; select "discount" from "OrderLine" limit 1;`
Expected: both queries return `null`/`0` for existing rows, no error.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors (existing pre-existing errors, if any from an unrelated stale `.env`, are not this task's concern — see `docs/superpowers/EXECUTION-STATUS.md` §"prisma generate gotcha" if `Cannot find module '@/lib/generated/prisma/client'` appears).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260715100000_pos_payment_and_discount/migration.sql
git commit -m "feat(db): add Order.paymentMethod and OrderLine.discount for POS sales"
```

---

### Task 2: `buildOrderLines` — server-side discount computation

**Files:**
- Modify: `lib/orders/buildOrderLines.ts`
- Test: `lib/orders/buildOrderLines.test.ts`

**Interfaces:**
- Consumes: nothing new (pure function, no DB).
- Produces: `WebCartLineInput` gains optional `discounted?: boolean`; `OrderLineData` gains `discount: number`; new export `POS_DISCOUNT_RATE = 0.1`. Consumed by Task 5 (`encaisserVente`) and unchanged by Task 4/existing `submitWebOrder` (which never sets `discounted`, so `discount` stays `0` — no behavior change for web orders).

- [ ] **Step 1: Update the existing test's expectations and add discount test cases**

Replace the full contents of `lib/orders/buildOrderLines.test.ts`:

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
      { productId: "p1", nameAtOrder: "Foulard Wax Abidjan", qty: 2, unitPrice: 12500, discount: 0, lineTotal: 25000 },
      { productId: "p9", nameAtOrder: "Broche dorée", qty: 1, unitPrice: 4500, discount: 0, lineTotal: 4500 },
    ]);
    expect(result.total).toBe(29500);
  });

  it("applies a 10% discount to a line marked discounted, recomputed from the server price", () => {
    const result = buildOrderLines([{ productId: "p1", qty: 2, discounted: true }], PRODUCTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 12500 * 0.1 = 1250 discount per unit → (12500 - 1250) * 2 = 22500
    expect(result.lines).toEqual([
      { productId: "p1", nameAtOrder: "Foulard Wax Abidjan", qty: 2, unitPrice: 12500, discount: 1250, lineTotal: 22500 },
    ]);
    expect(result.total).toBe(22500);
  });

  it("keeps discount at 0 for a line explicitly marked not discounted", () => {
    const result = buildOrderLines([{ productId: "p1", qty: 1, discounted: false }], PRODUCTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0].discount).toBe(0);
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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/orders/buildOrderLines.test.ts`
Expected: FAIL — the first test fails because actual lines don't have a `discount` key yet; the two new discount tests fail with `TypeError` or wrong `lineTotal`.

- [ ] **Step 3: Implement the discount computation**

Replace the full contents of `lib/orders/buildOrderLines.ts`:

```ts
export interface WebCartLineInput {
  productId: string;
  qty: number;
  /** Remise POS de 10% appliquée à cette ligne — absent/false pour une commande web. */
  discounted?: boolean;
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
  discount: number;
  lineTotal: number;
}

/** Taux de remise POS fixe (bouton "Ajouter remise -10%" du panier caisse). */
export const POS_DISCOUNT_RATE = 0.1;

/**
 * Construit les lignes de commande et le total à partir de prix serveur —
 * jamais du prix envoyé par le client. `products` doit contenir un prix
 * actuel par `productId` (lu depuis Postgres par l'appelant). La remise
 * (le cas échéant) est elle aussi recalculée ici à partir du prix serveur,
 * jamais reçue en FCFA depuis le client.
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
    const discount = line.discounted ? Math.round(product.price * POS_DISCOUNT_RATE) : 0;
    lines.push({
      productId: product.id,
      nameAtOrder: product.name,
      qty: line.qty,
      unitPrice: product.price,
      discount,
      lineTotal: (product.price - discount) * line.qty,
    });
  }
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { ok: true, lines, total };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/orders/buildOrderLines.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors. (`submitWebOrder` in `lib/orders/actions.ts` calls `buildOrderLines` with plain `{productId, qty}` objects — still valid since `discounted` is optional.)

- [ ] **Step 6: Commit**

```bash
git add lib/orders/buildOrderLines.ts lib/orders/buildOrderLines.test.ts
git commit -m "feat(orders): compute per-line discount server-side in buildOrderLines"
```

---

### Task 3: POS input validator

**Files:**
- Create: `lib/validators/pos.ts`

**Interfaces:**
- Produces: `posSaleSchema` (Zod), `type PosSaleInput = z.infer<typeof posSaleSchema>` — consumed by Task 5 (`encaisserVente`).

- [ ] **Step 1: Create the validator**

```ts
import { z } from "zod";

export const posSaleLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  discounted: z.boolean().default(false),
});

export const posSaleSchema = z.object({
  lines: z.array(posSaleLineSchema).min(1, "Le panier est vide."),
  paymentMethod: z.enum(["espece", "mm", "mixte"]),
  customerId: z.string().min(1).nullable().optional(),
});

export type PosSaleLineInput = z.infer<typeof posSaleLineSchema>;
export type PosSaleInput = z.infer<typeof posSaleSchema>;
```

No dedicated test file — matches the established convention for plain-schema validators without a manual wrapper function (`lib/validators/product.ts`, `lib/validators/theme.ts`, `lib/validators/orderEdit.ts` have none either; only `kyc.ts`/`auth.ts`, which expose a `validate*` function, have `.test.ts` files).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/validators/pos.ts
git commit -m "feat(pos): add posSaleSchema validator"
```

---

### Task 4: Extract shared loyalty helper, refactor `confirmOrder`

**Files:**
- Create: `lib/customers/applyLoyaltyOrder.ts`
- Modify: `lib/orders/actions.ts` (the `confirmOrder` function, and its import list)

**Interfaces:**
- Consumes: `computeLoyalty` (`lib/customers/loyalty.ts`, unchanged), `normalizePhone` (`lib/customers/normalizePhone.ts`, unchanged), `initials` (`lib/format.ts`, unchanged), `Prisma.TransactionClient` (`@/lib/generated/prisma/client`).
- Produces: `applyLoyaltyOrder(params): Promise<{ customerId: string; vipBefore: boolean }>` — consumed by Task 5 (`encaisserVente`) and by the refactored `confirmOrder` in this task.

- [ ] **Step 1: Create the helper**

```ts
import type { Prisma } from "@/lib/generated/prisma/client";
import { initials } from "@/lib/format";
import { normalizePhone } from "./normalizePhone";
import { computeLoyalty } from "./loyalty";

export interface ApplyLoyaltyOrderParams {
  tx: Prisma.TransactionClient;
  tenantId: string;
  orderTotal: number;
  /** Cliente déjà connue (vente POS) — ne met à jour que ses compteurs de fidélité, ni nom ni lieu. */
  customerId?: string | null;
  /** Utilisés uniquement quand `customerId` est absent (commande web) : matching par téléphone normalisé, création si aucune correspondance. */
  clientName?: string;
  phone?: string;
  place?: string;
}

/**
 * Rattache une commande (web validée ou vente POS) à une fiche cliente et
 * met à jour ses compteurs de fidélité (`computeLoyalty`). `vipBefore`
 * renvoie le statut VIP de la cliente **avant** cette commande — utile pour
 * un snapshot `Order.vipAtOrder` fiable côté appelant.
 */
export async function applyLoyaltyOrder(
  params: ApplyLoyaltyOrderParams
): Promise<{ customerId: string; vipBefore: boolean }> {
  const { tx, tenantId, orderTotal } = params;

  if (params.customerId) {
    const existing = await tx.customer.findUniqueOrThrow({ where: { id: params.customerId } });
    const newOrdersCount = existing.ordersCount + 1;
    const newTotalSpent = existing.totalSpent + orderTotal;
    const { points, vip, segment } = computeLoyalty(newTotalSpent, newOrdersCount);
    const updated = await tx.customer.update({
      where: { id: existing.id },
      data: { ordersCount: newOrdersCount, totalSpent: newTotalSpent, points, vip, segment },
    });
    return { customerId: updated.id, vipBefore: existing.vip };
  }

  const clientName = params.clientName ?? "";
  const phone = params.phone ?? "";
  const place = params.place ?? "";
  const normalizedPhone = normalizePhone(phone);
  const candidates = await tx.customer.findMany({ where: { tenantId } });
  const existing = candidates.find((c) => normalizePhone(c.phone) === normalizedPhone);

  const newOrdersCount = (existing?.ordersCount ?? 0) + 1;
  const newTotalSpent = (existing?.totalSpent ?? 0) + orderTotal;
  const { points, vip, segment } = computeLoyalty(newTotalSpent, newOrdersCount);

  const customer = existing
    ? await tx.customer.update({
        where: { id: existing.id },
        data: {
          name: clientName,
          place,
          ordersCount: newOrdersCount,
          totalSpent: newTotalSpent,
          points,
          vip,
          segment,
        },
      })
    : await tx.customer.create({
        data: {
          tenantId,
          name: clientName,
          initials: initials(clientName),
          phone,
          place,
          ordersCount: newOrdersCount,
          totalSpent: newTotalSpent,
          points,
          vip,
          segment,
        },
      });

  return { customerId: customer.id, vipBefore: existing?.vip ?? false };
}
```

- [ ] **Step 2: Refactor `confirmOrder` to use the helper**

In `lib/orders/actions.ts`, change the import line:

```ts
import { initials, money } from "@/lib/format";
import { normalizePhone } from "@/lib/customers/normalizePhone";
import { computeLoyalty } from "@/lib/customers/loyalty";
```

to:

```ts
import { money } from "@/lib/format";
import { applyLoyaltyOrder } from "@/lib/customers/applyLoyaltyOrder";
```

Then replace this block inside `confirmOrder` (the loyalty section, between the stock-decrement loop and the final `tx.order.update`):

```ts
      // Rattachement fidélité : miroir de la déduction de stock ci-dessus,
      // uniquement à la validation. Rapprochement par téléphone normalisé
      // (le format KYC est libre, la comparaison brute créerait des doublons).
      const normalizedPhone = normalizePhone(order.phone);
      const candidates = await tx.customer.findMany({ where: { tenantId: tenant.id } });
      const existing = candidates.find((c) => normalizePhone(c.phone) === normalizedPhone);

      const newOrdersCount = (existing?.ordersCount ?? 0) + 1;
      const newTotalSpent = (existing?.totalSpent ?? 0) + order.total;
      const { points, vip, segment } = computeLoyalty(newTotalSpent, newOrdersCount);

      const customer = existing
        ? await tx.customer.update({
            where: { id: existing.id },
            data: {
              name: order.clientName,
              place: order.place,
              ordersCount: newOrdersCount,
              totalSpent: newTotalSpent,
              points,
              vip,
              segment,
            },
          })
        : await tx.customer.create({
            data: {
              tenantId: tenant.id,
              name: order.clientName,
              initials: initials(order.clientName),
              phone: order.phone,
              place: order.place,
              ordersCount: newOrdersCount,
              totalSpent: newTotalSpent,
              points,
              vip,
              segment,
            },
          });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "confirmee", customerId: customer.id },
      });
```

with:

```ts
      // Rattachement fidélité : miroir de la déduction de stock ci-dessus,
      // uniquement à la validation.
      const { customerId } = await applyLoyaltyOrder({
        tx,
        tenantId: tenant.id,
        orderTotal: order.total,
        clientName: order.clientName,
        phone: order.phone,
        place: order.place,
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "confirmee", customerId },
      });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors. If `initials`/`normalizePhone`/`computeLoyalty` show as unused anywhere else in `lib/orders/actions.ts`, the import line above already removes them — confirm no other function in that file used them (it doesn't; only `confirmOrder` did).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no test directly covers `confirmOrder` (it's a Server Action requiring a live DB, same as before), so nothing should break here; this just confirms no import/syntax regression.

- [ ] **Step 5: Verify `confirmOrder` behavior is unchanged — browser check**

This is a Prisma transaction touching production data — verify manually, don't just trust the refactor:
1. Start the dev server, sign in as owner.
2. Go to `/admin/commandes`, find an order with status "À valider".
3. Click "Valider". Confirm: stock decreases in `/admin/inventaire`, the order moves to "Confirmées", and (if the phone matches an existing customer) that customer's points/orders count increases in `/admin/clientes`. If the phone is new, confirm a new customer row appears.

- [ ] **Step 6: Commit**

```bash
git add lib/customers/applyLoyaltyOrder.ts lib/orders/actions.ts
git commit -m "refactor(orders): extract applyLoyaltyOrder, shared by confirmOrder and the future POS action"
```

---

### Task 5: `encaisserVente` Server Action

**Files:**
- Create: `lib/pos/actions.ts`

**Interfaces:**
- Consumes: `posSaleSchema`/`PosSaleInput` (Task 3), `buildOrderLines` (Task 2), `aggregateQtyByProduct` (`lib/orders/stockCheck.ts`, unchanged), `applyLoyaltyOrder` (Task 4), `requireZone` (`lib/auth`, unchanged), `getCurrentTenant` (`lib/tenant`, unchanged).
- Produces: `encaisserVente(input: PosSaleInput): Promise<{ok: true; ref: string} | {ok: false; error: string}>` — consumed by Task 7 (`PosScreen.tsx`).

- [ ] **Step 1: Create the Server Action**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { posSaleSchema, type PosSaleInput } from "@/lib/validators/pos";
import { buildOrderLines } from "@/lib/orders/buildOrderLines";
import { aggregateQtyByProduct } from "@/lib/orders/stockCheck";
import { applyLoyaltyOrder } from "@/lib/customers/applyLoyaltyOrder";

export async function encaisserVente(
  input: PosSaleInput
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, id: { in: parsed.data.lines.map((l) => l.productId) } },
      });
      const built = buildOrderLines(parsed.data.lines, products);
      if (!built.ok) throw new Error(built.error);

      const demand = aggregateQtyByProduct(built.lines);
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const product = products.find((p) => p.id === productId);
        if (!product || product.stock < qty) {
          throw new Error(`Stock insuffisant pour ${nameAtOrder}.`);
        }
      }
      for (const [productId, { qty }] of demand) {
        await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } });
      }

      let clientName = "Client comptoir";
      let phone = "";
      let place = "Vente en boutique";
      let customerId: string | null = null;
      let vipAtOrder = false;

      if (parsed.data.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, tenantId: tenant.id },
        });
        if (!customer) throw new Error("Cliente introuvable.");
        const loyalty = await applyLoyaltyOrder({
          tx,
          tenantId: tenant.id,
          orderTotal: built.total,
          customerId: customer.id,
        });
        customerId = loyalty.customerId;
        vipAtOrder = loyalty.vipBefore;
        clientName = customer.name;
        phone = customer.phone;
        place = customer.place;
      }

      return tx.order.create({
        data: {
          tenantId: tenant.id,
          clientName,
          place,
          phone,
          channel: "Boutique",
          status: "livree",
          paymentMethod: parsed.data.paymentMethod,
          vipAtOrder,
          customerId,
          total: built.total,
          lines: { create: built.lines },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/clientes");
    return { ok: true, ref: order.ref };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known =
      message.startsWith("Produit introuvable") ||
      message === "Quantité invalide." ||
      message === "Le panier est vide." ||
      message.startsWith("Stock insuffisant pour ") ||
      message === "Cliente introuvable.";
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/pos/actions.ts
git commit -m "feat(pos): add encaisserVente Server Action — real persistence for counter sales"
```

---

### Task 6: `useBackoffice` store — remove `encaisser`, add `showTicket`

**Files:**
- Modify: `lib/store/useBackoffice.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Ticket` gains `ref: string`; store gains `showTicket: (ticket: Ticket) => void` (replaces `encaisser`) — consumed by Task 7 (`PosScreen.tsx`).

- [ ] **Step 1: Update the `Ticket` interface**

Change:

```ts
export interface Ticket {
  items: number;
  pay: string;
  total: string;
}
```

to:

```ts
export interface Ticket {
  items: number;
  pay: string;
  total: string;
  ref: string;
}
```

- [ ] **Step 2: Replace `encaisser` with `showTicket` in the state interface**

Change:

```ts
  attachClient: (customer: Customer) => void;
  detachClient: () => void;
  encaisser: () => void;
  openCart: () => void;
```

to:

```ts
  attachClient: (customer: Customer) => void;
  detachClient: () => void;
  showTicket: (ticket: Ticket) => void;
  openCart: () => void;
```

- [ ] **Step 3: Replace the `encaisser` implementation with `showTicket`**

Change:

```ts
  encaisser: () => {
    const s = get();
    if (!s.cart.length) return;
    const sub = s.cart.reduce((a, l) => a + l.price * l.qty, 0);
    const disc = s.cart.reduce((a, l) => a + l.discount * l.qty, 0);
    const items = s.cart.reduce((a, l) => a + l.qty, 0);
    const payLabels: Record<BackofficeState["pay"], string> = {
      espece: "Espèces",
      mm: "Mobile Money",
      mixte: "Mixte",
    };
    if (s.offline) {
      set({ queued: s.queued + 1, cart: [], client: null, cartOpen: false });
      get().showToast("Vente mise en file — à resynchroniser", "warning");
      return;
    }
    set({
      ticket: { items, pay: payLabels[s.pay], total: money(sub - disc) },
      cart: [],
      client: null,
      cartOpen: false,
    });
  },
```

to:

```ts
  showTicket: (ticket) => set({ ticket, cart: [], client: null, cartOpen: false }),
```

`get` is still used elsewhere in the file (`encaisser` was its only other user besides `toggleOffline`, which also uses it) — do not remove the `get` parameter from `create<BackofficeState>((set, get) => ...)`. `money` becomes unused in this file after removing `encaisser`'s `money(sub - disc)` call — remove the now-unused import: change `import { money } from "@/lib/format";` — check first whether `money` is used elsewhere in this file (it is not, per the current file) — remove the line entirely.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: errors in `components/dashboard/screens/PosScreen.tsx` (still calling `s.encaisser`) and `components/dashboard/TicketModal.tsx` (not yet updated) — expected at this point, fixed in Tasks 7–8.

- [ ] **Step 5: Commit**

```bash
git add lib/store/useBackoffice.ts
git commit -m "refactor(pos): replace useBackoffice.encaisser with showTicket, add Ticket.ref"
```

---

### Task 7: Wire `PosScreen.tsx` to `encaisserVente`

**Files:**
- Modify: `components/dashboard/screens/PosScreen.tsx`

**Interfaces:**
- Consumes: `encaisserVente` (Task 5), `showTicket` (Task 6).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports and a payment-label map**

At the top of the file, change:

```ts
"use client";

import { useMemo, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { categories } from "@/lib/data/catalog";
import { money } from "@/lib/format";
import { useBackoffice, type CartLine } from "@/lib/store/useBackoffice";
import type { Customer, Product } from "@/lib/data/types";

const PAY_DEF = [
  { id: "espece", label: "Espèces", icon: ICONS.cash },
  { id: "mm", label: "Mobile M.", icon: ICONS.mobileMoney },
  { id: "mixte", label: "Mixte", icon: ICONS.mixte },
] as const;
```

to:

```ts
"use client";

import { useMemo, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { categories } from "@/lib/data/catalog";
import { money } from "@/lib/format";
import { useBackoffice, type CartLine } from "@/lib/store/useBackoffice";
import { encaisserVente } from "@/lib/pos/actions";
import type { Customer, Product } from "@/lib/data/types";

const PAY_DEF = [
  { id: "espece", label: "Espèces", icon: ICONS.cash },
  { id: "mm", label: "Mobile M.", icon: ICONS.mobileMoney },
  { id: "mixte", label: "Mixte", icon: ICONS.mixte },
] as const;

const PAY_LABELS: Record<"espece" | "mm" | "mixte", string> = {
  espece: "Espèces",
  mm: "Mobile Money",
  mixte: "Mixte",
};
```

- [ ] **Step 2: Replace `PayButton`**

Change:

```ts
function PayButton({ total, big }: { total: number; big?: boolean }) {
  const cart = useBackoffice((s) => s.cart);
  const offline = useBackoffice((s) => s.offline);
  const encaisser = useBackoffice((s) => s.encaisser);
  const has = cart.length > 0;
  return (
    <button
      onClick={encaisser}
      disabled={!has}
      className="ft-primary-btn"
      style={{
        width: "100%",
        height: big ? 54 : 52,
        border: "none",
        borderRadius: 10,
        background: has ? (offline ? colors.warning : colors.primary) : colors.disabled,
        color: "#fff",
        font: `700 16px ${fonts.ui}`,
        cursor: has ? "pointer" : "not-allowed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {!big && <Icon path={ICONS.check} size={20} stroke="#fff" strokeWidth={2} />}
      Encaisser {has ? `· ${money(total)}` : ""}
    </button>
  );
}
```

to:

```ts
function PayButton({ total, big }: { total: number; big?: boolean }) {
  const cart = useBackoffice((s) => s.cart);
  const pay = useBackoffice((s) => s.pay);
  const client = useBackoffice((s) => s.client);
  const offline = useBackoffice((s) => s.offline);
  const showToast = useBackoffice((s) => s.showToast);
  const showTicket = useBackoffice((s) => s.showTicket);
  const [saving, setSaving] = useState(false);
  const has = cart.length > 0;
  const canPay = has && !offline && !saving;

  async function handlePay() {
    setSaving(true);
    const result = await encaisserVente({
      lines: cart.map((l) => ({ productId: l.id, qty: l.qty, discounted: l.discount > 0 })),
      paymentMethod: pay,
      customerId: client?.id ?? null,
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showTicket({
      items: cart.reduce((a, l) => a + l.qty, 0),
      pay: PAY_LABELS[pay],
      total: money(total),
      ref: result.ref,
    });
  }

  return (
    <button
      onClick={handlePay}
      disabled={!canPay}
      className="ft-primary-btn"
      style={{
        width: "100%",
        height: big ? 54 : 52,
        border: "none",
        borderRadius: 10,
        background: canPay ? colors.primary : colors.disabled,
        color: "#fff",
        font: `700 16px ${fonts.ui}`,
        cursor: canPay ? "pointer" : "not-allowed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {!big && !saving && <Icon path={ICONS.check} size={20} stroke="#fff" strokeWidth={2} />}
      {offline ? "Connexion requise" : saving ? "Encaissement…" : `Encaisser${has ? ` · ${money(total)}` : ""}`}
    </button>
  );
}
```

Note: `cart` line items already carry `id` as the product id (see `addToCart` in `useBackoffice.ts`: `cart.push({ id: p.id, ... })`), so `l.id` is the correct `productId` for the payload.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors in this file. (`components/dashboard/TicketModal.tsx` still has a pre-existing error from Task 6, fixed next.)

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/screens/PosScreen.tsx
git commit -m "feat(pos): PayButton calls encaisserVente, disabled while offline"
```

---

### Task 8: `TicketModal.tsx` shows the order reference

**Files:**
- Modify: `components/dashboard/TicketModal.tsx`

**Interfaces:**
- Consumes: `Ticket.ref` (Task 6).

- [ ] **Step 1: Add a reference row**

Change:

```tsx
        <div style={{ padding: "20px 24px" }}>
          <Row label="Articles" value={String(ticket.items)} />
          <Row label="Mode de paiement" value={ticket.pay} strong />
```

to:

```tsx
        <div style={{ padding: "20px 24px" }}>
          <Row label="Référence" value={ticket.ref} strong />
          <Row label="Articles" value={String(ticket.items)} />
          <Row label="Mode de paiement" value={ticket.pay} strong />
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: clean — no errors anywhere (this was the last consumer of the old `Ticket` shape).

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all tests (including the new `buildOrderLines` cases from Task 2).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/TicketModal.tsx
git commit -m "feat(pos): show the real order reference on the sale ticket"
```

---

### Task 9: Hide the WhatsApp contact button when a commande has no phone

**Files:**
- Modify: `components/dashboard/screens/OrdersScreen.tsx`

**Interfaces:**
- Consumes: nothing new (uses existing `o.phone`, `whatsappLink` already imported in this file).

- [ ] **Step 1: Wrap the WhatsApp link in a phone check**

Locate this block inside `OrderDetail` (right after the "Panier" items list, before the `actionable ? (` block):

```tsx
        <a
          href={whatsappLink(o.phone, `Bonjour ${o.client}, à propos de votre commande ${o.id}…`)}
          target="_blank"
          rel="noopener noreferrer"
          className="ft-hover-surface"
          style={{
            width: "100%",
            height: 44,
            border: `1.5px solid ${colors.success}`,
            borderRadius: 10,
            background: colors.bgSuccess,
            color: colors.fgSuccess,
            font: `600 13.5px ${fonts.ui}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginBottom: 14,
            textDecoration: "none",
          }}
        >
          <Icon path={ICONS.whatsapp} size={17} stroke={colors.success} strokeWidth={1.9} />
          Contacter la cliente (WhatsApp / appel)
        </a>
```

Replace with:

```tsx
        {o.phone && (
          <a
            href={whatsappLink(o.phone, `Bonjour ${o.client}, à propos de votre commande ${o.id}…`)}
            target="_blank"
            rel="noopener noreferrer"
            className="ft-hover-surface"
            style={{
              width: "100%",
              height: 44,
              border: `1.5px solid ${colors.success}`,
              borderRadius: 10,
              background: colors.bgSuccess,
              color: colors.fgSuccess,
              font: `600 13.5px ${fonts.ui}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              marginBottom: 14,
              textDecoration: "none",
            }}
          >
            <Icon path={ICONS.whatsapp} size={17} stroke={colors.success} strokeWidth={1.9} />
            Contacter la cliente (WhatsApp / appel)
          </a>
        )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/screens/OrdersScreen.tsx
git commit -m "fix(orders): hide WhatsApp contact button when the order has no phone (counter sale, no customer attached)"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and test suite**

Run: `npx tsc --noEmit -p .`
Expected: clean.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Browser walkthrough — sale with an attached customer**

1. Start the dev server, sign in as owner, go to `/admin/pos`.
2. Rattacher une cliente existante (picker), ajouter 2 produits différents au panier, appliquer une remise sur une ligne, choisir "Mobile Money".
3. Cliquer "Encaisser". Expected: ticket affiché avec la vraie référence (`#TER-XXXX`), panier vidé, cliente détachée.
4. Aller sur `/admin/commandes`, filtrer "Toutes" ou "Livrées" : la vente apparaît avec `channel: Boutique`, statut "Livrée".
5. Aller sur `/admin/inventaire` : le stock des 2 produits a diminué du montant vendu.
6. Aller sur `/admin/clientes`, ouvrir la fiche de la cliente rattachée : `ordersCount`/`totalSpent`/points ont augmenté, cohérent avec `computeLoyalty`.

- [ ] **Step 3: Browser walkthrough — sale without an attached customer**

1. Sur `/admin/pos`, ajouter un produit sans rattacher de cliente, choisir "Espèces", encaisser.
2. Vérifier dans `/admin/commandes` que la commande a `clientName: "Client comptoir"`, `place: "Vente en boutique"`.
3. Ouvrir son détail : le bouton "Contacter la cliente (WhatsApp)" est absent (téléphone vide).

- [ ] **Step 4: Browser walkthrough — insufficient stock**

1. Sur `/admin/inventaire`, repérer un produit à faible stock (ou en ajuster un à 1 via la fiche produit).
2. Sur `/admin/pos`, ajouter ce produit avec une quantité supérieure au stock disponible.
3. Encaisser. Expected: toast d'erreur "Stock insuffisant pour <produit>", panier conservé (pas vidé), aucune commande créée (vérifier `/admin/commandes`).

- [ ] **Step 5: Browser walkthrough — offline toggle**

1. Dans la Sidebar, activer "Hors-ligne".
2. Sur `/admin/pos`, ajouter un produit au panier.
3. Expected: le bouton "Encaisser" est désactivé et affiche "Connexion requise" — pas de faux message de mise en file.
4. Désactiver "Hors-ligne" : le bouton redevient actif.

- [ ] **Step 6: Confirm no regression on the web order flow**

1. Depuis la vitrine (déconnecté), passer une commande via le panier normal.
2. Vérifier qu'elle apparaît dans `/admin/commandes` en statut "À valider", et que la valider fonctionne toujours (stock déduit, cliente rattachée/créée) — comportement de `confirmOrder` inchangé après le refactor du Task 4.

- [ ] **Step 7: Update `docs/superpowers/EXECUTION-STATUS.md`**

Add an entry noting this sub-project is complete, following the existing format in that file (see how prior sub-projects — auth, catalog-stock, orders-workflow, customers-loyalty — are recorded).

- [ ] **Step 8: Final commit**

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record POS sale persistence sub-project completion"
```
