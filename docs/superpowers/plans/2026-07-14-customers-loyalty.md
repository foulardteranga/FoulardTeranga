# Clientes & fidélité (sous-projet 5/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `lib/data/clients.ts` (mock) to Postgres, link confirmed web orders to real `Customer` rows, compute loyalty points/segment on the same transaction that deducts stock, and wire the three consumer screens (dashboard customer sheet, POS picker, storefront account) to real data.

**Architecture:** Same client/server split pattern already used for `catalog.server.ts`/`orders.server.ts` (sub-projects 3/4): a new `lib/data/customers.server.ts` does Prisma reads, pure functions live in a new `lib/customers/` folder (phone normalization, loyalty math), and `confirmOrder` (`lib/orders/actions.ts`) gains a customer-matching step inside its existing Prisma transaction, mirroring how it already deducts stock.

**Tech Stack:** Next.js 16.2 (App Router, Server Components), Prisma 7.8 (`@prisma/adapter-pg`), Supabase Postgres (project `vqqwviknffequjvxmojo`), Zustand (`useBackoffice`), Vitest.

## Global Constraints

- TypeScript strict everywhere; never use `any` (prefer `unknown` + narrowing).
- Server Components by default; Server Actions validated and returning typed `{ ok, ... }` results, never an unhandled exception to a client-triggered action.
- Never expose `service_role`; RLS stays as-is (no policy changes in this sub-project — `Customer` already has policies from the foundation sub-project).
- Turbopack (`npm run dev` / `npm run build` without flags) is broken by the project folder's decomposed accented character — always use `npx next dev --webpack` / `npx next build --webpack` to verify. `npm run typecheck` and `npm run test` are unaffected.
- Loyalty rule is a server-side constant, not user-editable in this sub-project: 1 point per 1 000 FCFA spent, VIP threshold 150 points. The "Programme de fidélité" panel stays decorative.
- Customer loyalty data (points/segment/counters) is only ever mutated inside `confirmOrder`'s existing transaction, at validation — never at submission, never outside a transaction (mirrors the stock-deduction invariant, CLAUDE.md §4/§9).
- No Supabase Realtime for this sub-project (consistent with sub-project 4).
- Product/UI copy in French; code, identifiers, and commit messages in English. Conventional Commits, one commit per task.

---

## File Structure

| File | Change |
|---|---|
| `prisma/schema.prisma` | Modify — add `ordersCount`/`totalSpent` to `Customer`. |
| `prisma/migrations/20260714120000_customer_loyalty_counters/migration.sql` | Create — adds the two columns, backfills the 6 seeded demo customers. |
| `lib/customers/normalizePhone.ts` | Create — pure phone-normalization function. |
| `lib/customers/normalizePhone.test.ts` | Create. |
| `lib/customers/loyalty.ts` | Create — pure points/segment/VIP calculation. |
| `lib/customers/loyalty.test.ts` | Create. |
| `lib/data/types.ts` | Modify — add `CustomerOrderHistoryEntry`. |
| `lib/data/customers.server.ts` | Create — `getCustomers`, `getCustomerOrderHistory`, `toCustomer` (Prisma reads, server-only). |
| `lib/orders/actions.ts` | Modify — `confirmOrder` gains customer matching/creation + loyalty update. |
| `app/(dashboard)/clientes/page.tsx` | Modify — fetch customers + history server-side. |
| `components/dashboard/screens/CustomersScreen.tsx` | Modify — props instead of mock import, working search, real history. |
| `app/(storefront)/compte/page.tsx` | Modify — fetch a real customer server-side. |
| `components/storefront/views/AccountView.tsx` | Modify — props instead of mock import. |
| `app/(dashboard)/pos/page.tsx` | Modify — fetch customers alongside products. |
| `components/dashboard/screens/PosScreen.tsx` | Modify — `customers` prop threaded to a real search picker in `ClientBlock`. |
| `lib/store/useBackoffice.ts` | Modify — `attachClient(customer)` instead of hardcoded `clients[0]`. |
| `lib/data/clients.ts` | Delete. |

---

### Task 1: Schema migration — loyalty counters + demo data backfill

**Files:**
- Modify: `prisma/schema.prisma` (Customer model)
- Create: `prisma/migrations/20260714120000_customer_loyalty_counters/migration.sql`

**Interfaces:**
- Produces: `Customer.ordersCount: number`, `Customer.totalSpent: number` (both Postgres `integer not null default 0`), available to every later task via the regenerated Prisma Client.
- Note: `Order.customerId` is **already populated** on the 6 real seeded orders from sub-project 1 (verified live via `execute_sql` on 2026-07-14 — each of `#TER-0486`..`#TER-0492` already carries the matching `c1`..`c6` id). No backfill of `Order.customerId` is needed; this task only adds and backfills the two new counter columns.

- [ ] **Step 1: Update the Prisma schema**

Open `prisma/schema.prisma` and replace the `Customer` model block with:

```prisma
model Customer {
  id          String          @id @default(cuid())
  tenantId    String
  profileId   String?         @unique @db.Uuid
  name        String
  initials    String
  phone       String
  place       String
  points      Int             @default(0)
  ordersCount Int             @default(0)
  totalSpent  Int             @default(0)
  vip         Boolean         @default(false)
  segment     CustomerSegment
  createdAt   DateTime        @default(now())

  tenant  Tenant   @relation(fields: [tenantId], references: [id])
  profile Profile? @relation(fields: [profileId], references: [id])
  orders  Order[]

  @@index([tenantId])
}
```

- [ ] **Step 2: Regenerate the Prisma Client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client (7.8.0) to ./lib/generated/prisma`, exit code 0. `lib/generated/prisma/models/Customer.ts` now includes `ordersCount`/`totalSpent`.

- [ ] **Step 3: Verify current seeded customer ids before writing the backfill**

Call `mcp__supabase__execute_sql` with:
```sql
select id, name from "Customer" order by id;
```
Expected: exactly 6 rows with ids `c1`..`c6` (`c1` = Aya Koffi, `c2` = Adjoua N’Guessan, `c3` = Mariam Traoré, `c4` = Fatou Bamba, `c5` = Aminata Koné, `c6` = Grace Kouassi). If the ids differ from this, stop and adjust Step 4's `where id = ...` clauses to match the real ids before proceeding (don't guess).

- [ ] **Step 4: Write the migration SQL**

Create `prisma/migrations/20260714120000_customer_loyalty_counters/migration.sql`:

```sql
-- Nouveaux compteurs de fidélité sur Customer (nombre de commandes confirmées,
-- montant total dépensé), incrémentés désormais par confirmOrder à chaque
-- validation de commande web (miroir de la déduction de stock).
alter table "Customer" add column "ordersCount" integer not null default 0;
alter table "Customer" add column "totalSpent" integer not null default 0;

-- Backfill : préserve l'affichage démo existant. Order.customerId est déjà
-- renseigné sur les 6 commandes seedées au sous-projet 1 (vérifié en direct),
-- mais ces 6 commandes ne représentent qu'une infime partie des compteurs de
-- démo d'origine (lib/data/clients.ts) — ce script réinjecte ces valeurs
-- d'origine telles quelles, comme c'était déjà le cas avant cette migration.
update "Customer" set "ordersCount" = 14, "totalSpent" = 420000 where id = 'c1';
update "Customer" set "ordersCount" = 8,  "totalSpent" = 196000 where id = 'c2';
update "Customer" set "ordersCount" = 11, "totalSpent" = 312000 where id = 'c3';
update "Customer" set "ordersCount" = 4,  "totalSpent" = 88000  where id = 'c4';
update "Customer" set "ordersCount" = 2,  "totalSpent" = 34500  where id = 'c5';
update "Customer" set "ordersCount" = 9,  "totalSpent" = 254000 where id = 'c6';
```

- [ ] **Step 5: Apply the migration to the live Supabase project**

Call `mcp__supabase__apply_migration` with:
- `name`: `customer_loyalty_counters`
- `query`: the exact SQL content written in Step 4.

Expected: tool returns success with no error.

- [ ] **Step 6: Verify the backfill**

Call `mcp__supabase__execute_sql` with:
```sql
select id, "ordersCount", "totalSpent" from "Customer" order by id;
```
Expected: `c1` → `14`/`420000`, `c2` → `8`/`196000`, `c3` → `11`/`312000`, `c4` → `4`/`88000`, `c5` → `2`/`34500`, `c6` → `9`/`254000`.

- [ ] **Step 7: Verify the migration is recorded and typecheck is clean**

Call `mcp__supabase__list_migrations`.
Expected: an entry named `customer_loyalty_counters` (or matching timestamp prefix).

Run: `npm run typecheck`
Expected: exit code 0, no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260714120000_customer_loyalty_counters/migration.sql
git commit -m "feat: add ordersCount/totalSpent counters to Customer"
```

---

### Task 2: `normalizePhone` — pure phone comparison helper

**Files:**
- Create: `lib/customers/normalizePhone.ts`
- Test: `lib/customers/normalizePhone.test.ts`

**Interfaces:**
- Produces: `normalizePhone(raw: string): string` — used by Task 5 (`confirmOrder`) to compare a new order's phone against existing `Customer.phone` values.

- [ ] **Step 1: Write the failing test**

Create `lib/customers/normalizePhone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/customers/normalizePhone";

describe("normalizePhone", () => {
  it("strips spaces while keeping a leading + and all digits", () => {
    expect(normalizePhone("+225 07 12 45 67 89")).toBe("+2250712456789");
  });

  it("treats different separators as equivalent for the same number", () => {
    expect(normalizePhone("+225-07-12-45-67-89")).toBe(normalizePhone("+225 07 12 45 67 89"));
  });

  it("keeps a leading + but drops parentheses too", () => {
    expect(normalizePhone("+225 (07) 12-45-67-89")).toBe("+2250712456789");
  });

  it("returns digits only when there is no leading +", () => {
    expect(normalizePhone("0712456789")).toBe("0712456789");
  });

  it("does not merge a local number with its +country-code equivalent (known limitation, see spec §6)", () => {
    expect(normalizePhone("0712456789")).not.toBe(normalizePhone("+2250712456789"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/customers/normalizePhone.test.ts`
Expected: FAIL — `Cannot find module '@/lib/customers/normalizePhone'`.

- [ ] **Step 3: Write the implementation**

Create `lib/customers/normalizePhone.ts`:

```ts
/**
 * Normalise un numéro de téléphone saisi en format libre (KYC, lib/validators/kyc.ts)
 * pour permettre une comparaison fiable entre deux commandes de la même personne.
 * Conserve un éventuel `+` de tête, retire tout le reste sauf les chiffres.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasLeadingPlus ? `+${digits}` : digits;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/customers/normalizePhone.test.ts`
Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/customers/normalizePhone.ts lib/customers/normalizePhone.test.ts
git commit -m "feat: add normalizePhone for customer phone matching"
```

---

### Task 3: `computeLoyalty` — pure points/segment/VIP calculation

**Files:**
- Create: `lib/customers/loyalty.ts`
- Test: `lib/customers/loyalty.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `POINTS_PER_FCFA_UNIT: number`, `VIP_THRESHOLD_POINTS: number`, `computeLoyalty(totalSpent: number, ordersCount: number): { points: number; vip: boolean; segment: "VIP" | "Fidele" | "Nouvelle" }` — used by Task 5 (`confirmOrder`).

- [ ] **Step 1: Write the failing test**

Create `lib/customers/loyalty.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeLoyalty, POINTS_PER_FCFA_UNIT, VIP_THRESHOLD_POINTS } from "@/lib/customers/loyalty";

describe("computeLoyalty", () => {
  it("computes one point per 1 000 FCFA spent, rounded down", () => {
    const result = computeLoyalty(54500, 3);
    expect(result.points).toBe(54);
  });

  it("marks a customer VIP once points reach the threshold", () => {
    const result = computeLoyalty(VIP_THRESHOLD_POINTS * POINTS_PER_FCFA_UNIT, 5);
    expect(result.vip).toBe(true);
    expect(result.segment).toBe("VIP");
  });

  it("stays non-VIP just under the threshold", () => {
    const result = computeLoyalty(VIP_THRESHOLD_POINTS * POINTS_PER_FCFA_UNIT - 1000, 5);
    expect(result.vip).toBe(false);
  });

  it("segments a first-time customer as Nouvelle", () => {
    const result = computeLoyalty(12500, 1);
    expect(result.segment).toBe("Nouvelle");
  });

  it("segments a repeat non-VIP customer as Fidele", () => {
    const result = computeLoyalty(50000, 2);
    expect(result.segment).toBe("Fidele");
  });

  it("labels a VIP customer as VIP even on their first order, never Nouvelle", () => {
    const result = computeLoyalty(200000, 1);
    expect(result.vip).toBe(true);
    expect(result.segment).toBe("VIP");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/customers/loyalty.test.ts`
Expected: FAIL — `Cannot find module '@/lib/customers/loyalty'`.

- [ ] **Step 3: Write the implementation**

Create `lib/customers/loyalty.ts`:

```ts
/** 1 point acquis par tranche de 1 000 FCFA dépensé (constante métier, non éditable en v1). */
export const POINTS_PER_FCFA_UNIT = 1000;
/** Seuil de points à partir duquel une cliente passe VIP (constante métier, non éditable en v1). */
export const VIP_THRESHOLD_POINTS = 150;

export type CustomerLoyaltySegment = "VIP" | "Fidele" | "Nouvelle";

export interface LoyaltyResult {
  points: number;
  vip: boolean;
  segment: CustomerLoyaltySegment;
}

/**
 * Calcule points/statut VIP/segment à partir du total dépensé et du nombre de
 * commandes confirmées cumulés. Une fois VIP (points ne décroissent jamais en
 * v1), le segment ne redescend jamais vers Nouvelle/Fidele.
 */
export function computeLoyalty(totalSpent: number, ordersCount: number): LoyaltyResult {
  const points = Math.floor(totalSpent / POINTS_PER_FCFA_UNIT);
  const vip = points >= VIP_THRESHOLD_POINTS;
  const segment: CustomerLoyaltySegment = vip ? "VIP" : ordersCount === 1 ? "Nouvelle" : "Fidele";
  return { points, vip, segment };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/customers/loyalty.test.ts`
Expected: PASS, 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add lib/customers/loyalty.ts lib/customers/loyalty.test.ts
git commit -m "feat: add computeLoyalty for points/segment/VIP calculation"
```

---

### Task 4: `lib/data/customers.server.ts` — Postgres reads

**Files:**
- Modify: `lib/data/types.ts`
- Create: `lib/data/customers.server.ts`

**Interfaces:**
- Consumes: `Customer` (Prisma generated type, `@/lib/generated/prisma/client`), `prisma` (`@/lib/db/client`), `getCurrentTenant` (`@/lib/tenant`), `money` (`@/lib/format`), `formatOrderDate` (`./orderStatus`).
- Produces: `CustomerOrderHistoryEntry` (`lib/data/types.ts`, `{ ref: string; date: string; total: string }`), `getCustomers(): Promise<Customer[]>`, `getCustomerOrderHistory(customerId: string): Promise<CustomerOrderHistoryEntry[]>`, `toCustomer(row): Customer` (`lib/data/customers.server.ts`) — used by Tasks 6, 7, 8.

- [ ] **Step 1: Add `CustomerOrderHistoryEntry` to the shared types file**

In `lib/data/types.ts`, immediately after the existing `Customer` interface (after its closing `}`), add:

```ts
/** Une ligne de l'historique d'achats affiché sur une fiche cliente (dashboard) ou la page Compte (vitrine). */
export interface CustomerOrderHistoryEntry {
  ref: string;
  date: string;
  total: string;
}
```

- [ ] **Step 2: Create the server-only reads file**

Create `lib/data/customers.server.ts`:

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { money } from "@/lib/format";
import { formatOrderDate } from "./orderStatus";
import type { Customer as PrismaCustomer } from "@/lib/generated/prisma/client";
import type { Customer, CustomerOrderHistoryEntry, CustomerSegment } from "./types";

const SEGMENT_LABELS: Record<PrismaCustomer["segment"], CustomerSegment> = {
  VIP: "VIP",
  Fidele: "Fidèle",
  Nouvelle: "Nouvelle",
};

/** Convertit une fiche Prisma vers le type applicatif `Customer` (segment accentué, montant formaté). */
export function toCustomer(row: PrismaCustomer): Customer {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    phone: row.phone,
    place: row.place,
    points: row.points,
    orders: row.ordersCount,
    spent: money(row.totalSpent),
    vip: row.vip,
    seg: SEGMENT_LABELS[row.segment],
  };
}

/** Lit toutes les fiches clientes du tenant courant. */
export async function getCustomers(): Promise<Customer[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toCustomer);
}

/** Lit les commandes confirmées d'une cliente, les plus récentes d'abord. */
export async function getCustomerOrderHistory(customerId: string): Promise<CustomerOrderHistoryEntry[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.order.findMany({
    where: { customerId, tenantId: tenant.id, status: "confirmee" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((o) => ({ ref: o.ref, date: formatOrderDate(o.createdAt), total: money(o.total) }));
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/data/types.ts lib/data/customers.server.ts
git commit -m "feat: add Postgres-backed customer reads (getCustomers, getCustomerOrderHistory)"
```

---

### Task 5: `confirmOrder` — customer matching, creation, and loyalty update

**Files:**
- Modify: `lib/orders/actions.ts`

**Interfaces:**
- Consumes: `normalizePhone` (Task 2), `computeLoyalty` (Task 3), `initials` (`@/lib/format`, already exists).
- Produces: `confirmOrder` now also sets `Order.customerId` and creates/updates the matching `Customer` row — consumed indirectly by Task 6/7/8 screens (which read `Customer`/`Order` after this runs) and Task 9's live verification.

- [ ] **Step 1: Add the new imports**

At the top of `lib/orders/actions.ts`, after the existing `import { aggregateQtyByProduct } from "./stockCheck";` line, add:

```ts
import { initials } from "@/lib/format";
import { normalizePhone } from "@/lib/customers/normalizePhone";
import { computeLoyalty } from "@/lib/customers/loyalty";
```

- [ ] **Step 2: Replace the `confirmOrder` function**

Replace the entire existing `confirmOrder` function with:

```ts
export async function confirmOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id }, include: { lines: true } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "nouvelle") return; // idempotent : déjà traitée

      const demand = aggregateQtyByProduct(order.lines);
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || product.stock < qty) {
          throw new Error(`Stock insuffisant pour ${nameAtOrder}.`);
        }
      }
      for (const line of order.lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.qty } },
        });
      }

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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/clientes");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known = message === "Commande introuvable." || message.startsWith("Stock insuffisant pour ");
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 3: Typecheck and run the existing test suite**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

Run: `npm run test`
Expected: all existing tests still pass (this task adds no new Vitest coverage — `confirmOrder` is a Prisma transaction verified live in Task 9, consistent with how the rest of `lib/orders/actions.ts` is already verified per the sub-project 4 spec).

- [ ] **Step 4: Commit**

```bash
git add lib/orders/actions.ts
git commit -m "feat: match/create customer and update loyalty on order confirmation"
```

---

### Task 6: Dashboard customer sheet (`/admin/clientes`)

**Files:**
- Modify: `app/(dashboard)/clientes/page.tsx`
- Modify: `components/dashboard/screens/CustomersScreen.tsx`

**Interfaces:**
- Consumes: `getCustomers`, `getCustomerOrderHistory` (Task 4), `Customer`/`CustomerOrderHistoryEntry` (`@/lib/data/types`).

- [ ] **Step 1: Rewrite the page as an async Server Component**

Replace the contents of `app/(dashboard)/clientes/page.tsx`:

```tsx
import { getCustomers, getCustomerOrderHistory } from "@/lib/data/customers.server";
import { CustomersScreen } from "@/components/dashboard/screens/CustomersScreen";
import type { CustomerOrderHistoryEntry } from "@/lib/data/types";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const histories = await Promise.all(customers.map((c) => getCustomerOrderHistory(c.id)));
  const historyByCustomerId: Record<string, CustomerOrderHistoryEntry[]> = {};
  customers.forEach((c, i) => {
    historyByCustomerId[c.id] = histories[i];
  });

  return <CustomersScreen customers={customers} historyByCustomerId={historyByCustomerId} />;
}
```

- [ ] **Step 2: Rewrite `CustomersScreen` to take props, wire search, and use real history**

Replace the entire contents of `components/dashboard/screens/CustomersScreen.tsx`:

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import type { Customer, CustomerOrderHistoryEntry } from "@/lib/data/types";

const SEGMENTS = ["Toutes", "VIP", "Fidèle", "Nouvelle"] as const;

export function CustomersScreen({
  customers,
  historyByCustomerId,
}: {
  customers: Customer[];
  historyByCustomerId: Record<string, CustomerOrderHistoryEntry[]>;
}) {
  const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>("Toutes");
  const [query, setQuery] = useState("");
  const [selId, setSelId] = useState<string>(customers[0]?.id ?? "");

  const q = query.trim().toLowerCase();
  const list = customers.filter(
    (c) =>
      (seg === "Toutes" || c.seg === seg || (seg === "VIP" && c.vip)) &&
      (!q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
  );
  const cd = customers.find((c) => c.id === selId) ?? customers[0];
  const history = cd ? historyByCustomerId[cd.id] ?? [] : [];

  return (
    <div className="ft-pad">
      <div className="ft-cust-cols">
        {/* list */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", height: 38, padding: "0 12px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, gap: 8 }}>
              <Icon path={ICONS.search} size={16} stroke={colors.muted} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une cliente…"
                style={{ flex: 1, border: "none", outline: "none", font: `400 13px ${fonts.ui}`, background: "transparent" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, padding: "11px 16px", borderBottom: "1px solid #F1ECE2", flexWrap: "wrap" }}>
            {SEGMENTS.map((g) => {
              const on = seg === g;
              return (
                <button
                  key={g}
                  onClick={() => setSeg(g)}
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 999,
                    font: `600 12px ${fonts.ui}`,
                    cursor: "pointer",
                    border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                    background: on ? colors.primary : "#fff",
                    color: on ? "#fff" : colors.muted,
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {list.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: colors.muted, fontSize: 13 }}>
                Aucune cliente ne correspond à cette recherche.
              </div>
            ) : (
              list.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelId(c.id)}
                  className="ft-hover-surface"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: `1px solid ${colors.faintLine}`,
                    cursor: "pointer",
                    background: selId === c.id ? "#F7F3EC" : "#fff",
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: c.vip ? colors.ink : "#EEF0F7",
                      color: c.vip ? colors.gold : colors.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 14,
                      flex: "none",
                    }}
                  >
                    {c.initials}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</span>
                      {c.vip && <VipBadge small />}
                    </div>
                    <div style={{ fontSize: 12, color: colors.muted }}>
                      {c.orders} commandes · {c.spent}
                    </div>
                  </div>
                  <span style={{ font: `600 12.5px ${fonts.ui}`, color: colors.gold }}>★ {c.points}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* detail + loyalty */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!cd ? (
            <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "40px 20px", textAlign: "center", color: colors.muted, fontSize: 13.5 }}>
              Aucune cliente enregistrée pour l&apos;instant.
            </div>
          ) : (
            <>
              <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <span
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      background: cd.vip ? colors.ink : "#EEF0F7",
                      color: cd.vip ? colors.gold : colors.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 19,
                      flex: "none",
                    }}
                  >
                    {cd.initials}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20 }}>{cd.name}</span>
                      {cd.vip && <VipBadge />}
                    </div>
                    <div style={{ fontSize: 12.5, color: colors.muted }}>
                      {cd.phone} · {cd.place}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <StatBox label="Points" value={cd.points} color={colors.gold} />
                  <StatBox label="Dépensé" value={cd.spent} />
                  <StatBox label="Commandes" value={cd.orders} />
                </div>
                <div style={sectionLabel}>Historique d&apos;achats</div>
                {history.length === 0 ? (
                  <div style={{ padding: "9px 0", fontSize: 13, color: colors.muted }}>
                    Aucune commande confirmée pour l&apos;instant.
                  </div>
                ) : (
                  history.map((h) => (
                    <div
                      key={h.ref}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${colors.faintLine}`, fontSize: 13 }}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>{h.ref}</span> <span style={{ color: colors.muted }}>· {h.date}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{h.total}</span>
                    </div>
                  ))
                )}
              </div>

              {/* loyalty config */}
              <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Programme de fidélité</div>
                <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>Règles de points et promotions ciblées.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={fieldLabel}>1 point par tranche de</label>
                    <div style={suffixField}>
                      <input defaultValue="1 000" style={bareInput} />
                      <span style={{ color: colors.muted, fontSize: 13 }}>FCFA</span>
                    </div>
                  </div>
                  <div>
                    <label style={fieldLabel}>Seuil VIP</label>
                    <div style={suffixField}>
                      <input defaultValue="150" style={bareInput} />
                      <span style={{ color: colors.muted, fontSize: 13 }}>points</span>
                    </div>
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14, cursor: "pointer" }}>
                  <span style={{ width: 44, height: 26, borderRadius: 999, background: colors.success, position: "relative", flex: "none" }}>
                    <span style={{ position: "absolute", top: 3, left: 21, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                  </span>
                  <span style={{ fontSize: 13.5 }}>Promo d&apos;anniversaire automatique (−15%)</span>
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VipBadge({ small }: { small?: boolean }) {
  return (
    <span
      style={{
        font: `600 ${small ? 10 : 10.5}px ${fonts.ui}`,
        background: colors.ink,
        color: colors.gold,
        padding: small ? "1px 6px" : "2px 8px",
        borderRadius: 999,
        border: `1px solid ${colors.gold}`,
      }}
    >
      ★ VIP
    </span>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 11.5, color: colors.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 20, color: color ?? colors.ink }}>{value}</div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  font: `600 11px ${fonts.ui}`,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: colors.muted,
  marginBottom: 10,
};
const fieldLabel: React.CSSProperties = { display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 };
const suffixField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 42,
  padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  background: "#fff",
};
const bareInput: React.CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", font: `400 14px ${fonts.ui}` };
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/clientes/page.tsx" components/dashboard/screens/CustomersScreen.tsx
git commit -m "feat: migrate dashboard customer sheet to Postgres"
```

---

### Task 7: Storefront account page (`/compte`)

**Files:**
- Modify: `app/(storefront)/compte/page.tsx`
- Modify: `components/storefront/views/AccountView.tsx`

**Interfaces:**
- Consumes: `getCustomers`, `getCustomerOrderHistory` (Task 4).
- Note: this page stays a documented stub — it shows the tenant's first `Customer` row, not an authenticated identity (no customer auth exists yet; see spec §2, non-goal in EXECUTION-STATUS.md).

- [ ] **Step 1: Rewrite the page as an async Server Component**

Replace the contents of `app/(storefront)/compte/page.tsx`:

```tsx
import { getCustomers, getCustomerOrderHistory } from "@/lib/data/customers.server";
import { AccountView } from "@/components/storefront/views/AccountView";

export default async function AccountPage() {
  const customers = await getCustomers();
  const account = customers[0] ?? null;
  const history = account ? await getCustomerOrderHistory(account.id) : [];

  return <AccountView account={account} history={history} />;
}
```

- [ ] **Step 2: Rewrite `AccountView` to take props**

Replace the entire contents of `components/storefront/views/AccountView.tsx`:

```tsx
import { fonts, colors } from "@/lib/theme/tokens";
import { initials } from "@/lib/format";
import type { Customer, CustomerOrderHistoryEntry } from "@/lib/data/types";

export function AccountView({
  account,
  history,
}: {
  account: Customer | null;
  history: CustomerOrderHistoryEntry[];
}) {
  if (!account) {
    return (
      <div className="ft-store-page" style={{ maxWidth: 920, margin: "0 auto", textAlign: "center", padding: "60px 20px", color: colors.muted }}>
        Aucune donnée cliente disponible pour l&apos;instant.
      </div>
    );
  }

  return (
    <div className="ft-store-page" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <span style={{ width: 60, height: 60, flex: "none", borderRadius: 999, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", font: `600 22px ${fonts.ui}`, color: "#fff" }}>
          {initials(account.name)}
        </span>
        <div>
          <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
            Bonjour, {account.name.split(" ")[0]}
          </h1>
          <div style={{ fontSize: 14, color: colors.muted }}>{account.phone}</div>
        </div>
      </div>

      <div className="ft-store-account-grid" style={{ display: "grid", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#1E1B18", borderRadius: 16, padding: "22px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "#2c2822", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={colors.gold} stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
            </span>
            <span style={{ font: `600 13px ${fonts.ui}`, color: "#C9BEB0" }}>Points Teranga</span>
            {account.vip && (
              <span style={{ marginLeft: "auto", font: `700 11px ${fonts.ui}`, padding: "3px 9px", borderRadius: 999, background: "#2c2822", color: colors.gold, border: `1px solid ${colors.gold}` }}>
                Palier Or
              </span>
            )}
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 38, lineHeight: 1 }}>
            {account.points} <span style={{ fontSize: 16, color: "#C9BEB0" }}>pts</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#2c2822", margin: "14px 0 8px", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.min(100, (account.points / 300) * 100)}%`, background: colors.gold }} />
          </div>
          <div style={{ fontSize: 12.5, color: "#C9BEB0" }}>
            {account.points >= 300 ? "Bon de 5% disponible !" : `Plus que ${300 - account.points} points avant votre bon de 5%.`}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ font: `600 14px ${fonts.ui}`, marginBottom: 16 }}>Mes coordonnées</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
            <Row label="Téléphone" value={account.phone} />
            <Row label="Livraison" value={account.place} />
            <Row label="Segment" value={account.seg} valueColor={colors.success} />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "22px 24px" }}>
        <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 16 }}>Historique des commandes</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13.5, color: colors.muted, padding: "8px 0" }}>Aucune commande confirmée pour l&apos;instant.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {history.map((o, i) => (
              <div key={o.ref} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid #EFEAE0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `600 14px ${fonts.ui}` }}>{o.ref}</div>
                  <div style={{ fontSize: 12.5, color: colors.muted }}>{o.date}</div>
                </div>
                <div style={{ font: `700 15px ${fonts.ui}`, color: colors.primary }}>{o.total}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(storefront)/compte/page.tsx" components/storefront/views/AccountView.tsx
git commit -m "feat: point the storefront account page at a real customer record"
```

---

### Task 8: POS customer picker

**Files:**
- Modify: `app/(dashboard)/pos/page.tsx`
- Modify: `components/dashboard/screens/PosScreen.tsx`
- Modify: `lib/store/useBackoffice.ts`

**Interfaces:**
- Consumes: `getCustomers` (Task 4), `Customer` (`@/lib/data/types`).
- Produces: `useBackoffice.attachClient(customer: Customer): void` (signature change — was `() => void`).

- [ ] **Step 1: Fetch customers alongside products in the POS page**

Replace the contents of `app/(dashboard)/pos/page.tsx`:

```tsx
import { getCatalog } from "@/lib/data/catalog.server";
import { getCustomers } from "@/lib/data/customers.server";
import { PosScreen } from "@/components/dashboard/screens/PosScreen";

export default async function PosPage() {
  const [products, customers] = await Promise.all([getCatalog(), getCustomers()]);
  return <PosScreen products={products} customers={customers} />;
}
```

- [ ] **Step 2: Change `attachClient`'s signature in the store**

In `lib/store/useBackoffice.ts`:

1. Remove the line `import { clients } from "@/lib/data/clients";`.
2. In the `BackofficeState` interface, change:
   ```ts
   attachClient: () => void;
   ```
   to:
   ```ts
   attachClient: (customer: Customer) => void;
   ```
3. In the store implementation, change:
   ```ts
   attachClient: () => set({ client: clients[0] }),
   ```
   to:
   ```ts
   attachClient: (customer) => set({ client: customer }),
   ```

`Customer` is already imported at the top of the file (`import type { Customer, Product } from "@/lib/data/types";`) — no import change needed there.

- [ ] **Step 3: Thread `customers` through `PosScreen` and rewrite `ClientBlock` as a real picker**

In `components/dashboard/screens/PosScreen.tsx`:

1. Change the type import at the top from:
   ```ts
   import type { Product } from "@/lib/data/types";
   ```
   to:
   ```ts
   import type { Customer, Product } from "@/lib/data/types";
   ```

2. Change the `PosScreen` function signature and its two `ClientBlock` consumers (`CartPanelDesktop`/`CartSheetMobile` calls) to accept and forward `customers`:

```tsx
export function PosScreen({ products, customers }: { products: Product[]; customers: Customer[] }) {
```

(rest of the function body unchanged, except the two JSX call sites below)

```tsx
      {/* cart desktop */}
      <CartPanelDesktop total={total} sub={sub} disc={disc} customers={customers} />
```

```tsx
      {/* mobile cart sheet */}
      {cartOpen && <CartSheetMobile total={total} onClose={closeCart} customers={customers} />}
```

3. Replace the entire `ClientBlock` function with:

```tsx
/* ----- Client attach block (shared) ----- */
function ClientBlock({ customers }: { customers: Customer[] }) {
  const client = useBackoffice((s) => s.client);
  const attachClient = useBackoffice((s) => s.attachClient);
  const detachClient = useBackoffice((s) => s.detachClient);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (client) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "#EEF0F7",
            color: colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 13,
            flex: "none",
          }}
        >
          {client.initials}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{client.name}</div>
          <div style={{ fontSize: 12, color: colors.gold, fontWeight: 600 }}>
            ★ {client.points} points fidélité
          </div>
        </div>
        <button
          onClick={detachClient}
          aria-label="Retirer la cliente"
          style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, fontSize: 18, padding: 4 }}
        >
          ×
        </button>
      </div>
    );
  }

  if (pickerOpen) {
    const q = query.trim().toLowerCase();
    const filtered = customers.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
    return (
      <div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher nom ou téléphone…"
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            border: `1.5px solid ${colors.borderField}`,
            borderRadius: 10,
            font: `400 13px ${fonts.ui}`,
            outline: "none",
          }}
        />
        <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 12.5, color: colors.muted, padding: "8px 2px" }}>Aucune cliente trouvée.</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  attachClient(c);
                  setPickerOpen(false);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 4px",
                  border: "none",
                  borderBottom: `1px solid ${colors.faintLine}`,
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                <span style={{ fontSize: 11.5, color: colors.muted }}>{c.phone}</span>
              </button>
            ))
          )}
        </div>
        <button
          onClick={() => {
            setPickerOpen(false);
            setQuery("");
          }}
          style={{ marginTop: 6, font: `500 12px ${fonts.ui}`, color: colors.muted, background: "none", border: "none", cursor: "pointer" }}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setPickerOpen(true)}
      style={{
        width: "100%",
        height: 42,
        border: `1.5px dashed ${colors.borderField}`,
        borderRadius: 10,
        background: colors.ivory,
        color: colors.primary,
        font: `600 13.5px ${fonts.ui}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Icon path={ICONS.personPlus} size={17} stroke={colors.primary} />
      Rattacher une cliente
    </button>
  );
}
```

4. Change the `CartPanelDesktop` and `CartSheetMobile` function signatures to accept and forward `customers` to `ClientBlock`:

```tsx
function CartPanelDesktop({ total, sub, disc, customers }: { total: number; sub: number; disc: number; customers: Customer[] }) {
```
...with its `<ClientBlock />` call site changed to `<ClientBlock customers={customers} />`.

```tsx
function CartSheetMobile({ total, onClose, customers }: { total: number; onClose: () => void; customers: Customer[] }) {
```
...with its `<ClientBlock />` call site changed to `<ClientBlock customers={customers} />`.

(All other code in these two functions — cart lines, totals, `PayMethods`/`PayButton` — stays exactly as-is.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit code 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/pos/page.tsx" components/dashboard/screens/PosScreen.tsx lib/store/useBackoffice.ts
git commit -m "feat: add a real customer search picker to the POS"
```

---

### Task 9: Remove the mock and verify the whole branch

**Files:**
- Delete: `lib/data/clients.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8.

- [ ] **Step 1: Delete the mock**

```bash
git rm lib/data/clients.ts
```

- [ ] **Step 2: Confirm no residual imports**

Run: `grep -rn "data/clients\"\|from \"@/lib/data/clients\"\|customerHistory" app components lib --include="*.ts" --include="*.tsx"`
Expected: no output (empty).

- [ ] **Step 3: Full automated verification**

Run: `npm run test`
Expected: all tests pass (existing suite + the new `normalizePhone`/`computeLoyalty` tests from Tasks 2–3), exit code 0.

Run: `npm run typecheck`
Expected: exit code 0, no errors.

Run: `npx next build --webpack`
Expected: build succeeds, route list includes `/admin/clientes`, `/admin/pos`, `/compte` (Turbopack itself stays broken by the project folder's decomposed accented character — this is the known, unrelated issue, use `--webpack` as documented in `EXECUTION-STATUS.md`).

- [ ] **Step 4: Commit the deletion**

```bash
git commit -m "chore: remove the clients.ts mock, fully migrated to Postgres"
```

- [ ] **Step 5: Live browser verification**

Start the dev server (`npx next dev --webpack`, or via the configured preview tool) and, using an already-authenticated owner session if available (never enter real credentials):

1. Go to `/admin/clientes`. Confirm the 6 seeded customers appear with their original points/segment/"Dépensé"/"Commandes" values (e.g. Aya Koffi: 186 pts, VIP, 420 000 FCFA, 14 commandes) — no visual regression from the migration.
2. Type into the search field (e.g. "Aya") and confirm the list filters by name; try a phone fragment too.
3. Select "Mariam Traoré" and confirm her "Historique d'achats" shows exactly one entry (`#TER-0489`, 86 000 FCFA — the only seeded order with `status = confirmee`); select a customer with no confirmed orders (e.g. "Aya Koffi") and confirm it shows "Aucune commande confirmée pour l'instant." instead of a stale/fake entry.
4. Go to `/admin/commandes`, submit and validate a **new** web order from `/panier` → `/commander` using a phone number that reuses an existing customer's number but reformatted differently (e.g. if an existing customer has `+225 07 12 45 67 89`, use `0712456789` or `+225-07-12-45-67-89` for the new order — pick one that normalizes to the *same* digits to test the match, and separately try one that normalizes differently to confirm it creates a new customer instead).
5. After validating, call `mcp__supabase__execute_sql` with `select id, name, "ordersCount", "totalSpent", points, segment from "Customer" order by "createdAt" desc limit 3;` and confirm the expected row was updated (existing customer's counters incremented) rather than a duplicate created, when the phone matched.
6. Go to `/admin/pos`, click "Rattacher une cliente", search by name and by phone fragment, select one, and confirm the ticket shows her name/points and that "×" detaches her.
7. Go to `/compte` and confirm it shows a real customer's name/points/segment/history instead of the old hardcoded "Aya Koffi" mock values (unless the first real customer happens to also be Aya Koffi — check the points/segment values match Postgres, not just the name).

Document any bug found and fix it before proceeding (update the relevant task's files, re-run Steps 3, re-verify live, then commit the fix separately with a `fix:` commit).

---

## Self-Review Notes

- **Spec coverage:** §3.1 (migration) → Task 1. §3.2 (`normalizePhone`) → Task 2. §3.3 (`computeLoyalty` + `confirmOrder` integration) → Tasks 3, 5. §3.4 (`customers.server.ts`) → Task 4. §3.5 (all four appellants: dashboard, POS, storefront, plus search/history wiring) → Tasks 6, 7, 8. §3.6 (delete mock) → Task 9. §5 (seed backfill) → Task 1, Step 4. §7 (tests) → Tasks 2, 3 (Vitest) + Task 9 (typecheck/build/live). §8 (success criteria) → Task 9.
- **Placeholder scan:** no TBD/TODO; every code step shows complete, runnable code.
- **Type consistency:** `Customer`/`CustomerOrderHistoryEntry` (from `lib/data/types.ts`) used identically across Tasks 4, 6, 7. `computeLoyalty`'s `CustomerLoyaltySegment` return values (`"VIP" | "Fidele" | "Nouvelle"`) match the Prisma `CustomerSegment` enum values used in the schema (Task 1) and consumed directly in Task 5's `tx.customer.update`/`create` calls. `attachClient(customer: Customer)` signature is introduced in Task 8 Step 2 and consumed consistently in Task 8 Step 3's `ClientBlock`.
