# Codes promo & points dépensables (Lot 3) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lot 3 du spec `docs/superpowers/specs/2026-07-20-payments-promos-ticket-finance-design.md` — la gérante crée des codes promo dans Marketing ; promo et points de fidélité (1 pt = 50 FCFA) se cumulent au POS et au checkout web ; pour une commande web, rien n'est débité avant la validation.

**Architecture:** Nouvelle table `PromoCode` (+ RLS) et 4 colonnes de remise sur `Order`. `Customer.points` devient un **solde** (gagné − dépensé) : `lib/customers/loyalty.ts` est refondu (statut VIP/segment dérivés de `totalSpent`, gain par vente crédité). Un moteur pur `lib/discounts/` (validation + plafonnements) est partagé par `encaisserVente` (débit immédiat) et `submitWebOrder`/`confirmOrder` (intention à la soumission, re-validation + débits à la validation). Marketing, POS, Checkout et Commandes consomment ces briques.

**Tech Stack:** Next.js 16.2 (Server Actions), Prisma 7 + Supabase Postgres (DDL via MCP), Zod 4, Zustand, Vitest.

## Global Constraints

- Langue produit : FR (libellés, erreurs). Code/commits : EN. TypeScript strict, jamais de `any`.
- `npm run build` (Turbopack) cassé (é NFD dans le chemin) — utiliser `npx next build --webpack`. `npm run test` / `npm run typecheck` normaux.
- DDL appliqué au projet Supabase via MCP (`apply_migration`), SQL committé sous `prisma/migrations/<ts>_<name>/migration.sql`, puis `npx prisma generate` localement. Toute nouvelle table → RLS + vérification `get_advisors`.
- **Invariant central (CLAUDE.md §4/§9)** : pour une commande web, AUCUN débit (stock, points, compteur promo) avant la validation par la gérante ; serveur ne fait jamais confiance au client (codes, points, totaux recalculés côté serveur).
- Constantes métier v1 non éditables : 1 point gagné / 1 000 FCFA payés ; 1 point = 50 FCFA de remise ; VIP dès 150 000 FCFA dépensés (équivalent exact de l'ancien seuil 150 points).
- Cumul : promo d'abord, points ensuite sur le restant, total plancher 0, points plafonnés au solde ET au restant.
- Résultats typés `{ ok } | { ok: false; error }`, messages FR. Conventional Commits. Après chaque tâche : `npm run test` + `npm run typecheck` verts.

---

### Task 1: Migration — PromoCode, colonnes Order, RLS

**Files:**
- Modify: `prisma/schema.prisma` (nouvel enum + nouveau model + 4 colonnes sur `Order` + relation sur `Tenant`)
- Create: `prisma/migrations/20260720150000_promo_codes_and_order_discounts/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: model Prisma `PromoCode` (champs ci-dessous), enum `PromoKind` (`percent | amount`), colonnes `Order.promoCode: String?`, `Order.promoDiscount/pointsUsed/pointsDiscount: Int @default(0)` — consommés par les Tasks 4, 6, 8.

- [ ] **Step 1: Étendre `prisma/schema.prisma`**

Ajouter après l'enum `NotificationType` :

```prisma
enum PromoKind {
  percent
  amount
}
```

Ajouter le model (après `StorefrontPage`) :

```prisma
model PromoCode {
  id        String    @id @default(cuid())
  tenantId  String
  code      String // stocké en MAJUSCULES, normalisé à la saisie
  kind      PromoKind
  value     Int // % (1-100) si percent, FCFA si amount
  minTotal  Int? // achat minimum en FCFA
  startsAt  DateTime?
  endsAt    DateTime?
  vipOnly   Boolean   @default(false)
  active    Boolean   @default(true)
  usedCount Int       @default(0)
  createdAt DateTime  @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

Dans `model Tenant`, ajouter à la liste des relations : `promoCodes PromoCode[]`.

Dans `model Order`, ajouter après `total Int` :

```prisma
  promoCode      String? // copie texte du code appliqué (historique stable)
  promoDiscount  Int     @default(0) // FCFA
  pointsUsed     Int     @default(0) // nb de points débités
  pointsDiscount Int     @default(0) // FCFA (= pointsUsed × 50 au taux du moment)
```

- [ ] **Step 2: Créer la migration SQL**

`prisma/migrations/20260720150000_promo_codes_and_order_discounts/migration.sql` :

```sql
CREATE TYPE "PromoKind" AS ENUM ('percent', 'amount');

CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "PromoKind" NOT NULL,
  "value" INTEGER NOT NULL,
  "minTotal" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "vipOnly" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PromoCode_tenantId_code_key" ON "PromoCode"("tenantId", "code");
CREATE INDEX "PromoCode_tenantId_idx" ON "PromoCode"("tenantId");

ALTER TABLE "Order" ADD COLUMN "promoCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "promoDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pointsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pointsDiscount" INTEGER NOT NULL DEFAULT 0;

-- RLS : lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant.
-- Aucun accès anon/customer : la validation d'un code passe par les Server Actions
-- Prisma (connexion directe, hors RLS), jamais par PostgREST.
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes_dashboard_select" ON "PromoCode"
  FOR SELECT TO authenticated
  USING (current_role() IN ('owner', 'staff') AND "tenantId" = current_tenant_id());

CREATE POLICY "promo_codes_dashboard_all" ON "PromoCode"
  FOR ALL TO authenticated
  USING (current_role() IN ('owner', 'staff') AND "tenantId" = current_tenant_id())
  WITH CHECK (current_role() IN ('owner', 'staff') AND "tenantId" = current_tenant_id());
```

Avant d'appliquer : vérifier avec `mcp__supabase__execute_sql` que les fonctions `current_role()` et `current_tenant_id()` existent (`SELECT proname FROM pg_proc WHERE proname IN ('current_role','current_tenant_id');` — elles ont été créées au sous-projet DB 1/5 et sont utilisées par les policies existantes ; si le schéma les préfixe, reprendre la forme exacte utilisée par une policy existante de la table `Product` via `SELECT policyname, qual FROM pg_policies WHERE tablename = 'Product';` et l'imiter).

- [ ] **Step 3: Appliquer via MCP et vérifier**

`mcp__supabase__apply_migration` avec `name: "promo_codes_and_order_discounts"` et le SQL ci-dessus. Puis :

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'PromoCode';           -- attendu: true
SELECT policyname FROM pg_policies WHERE tablename = 'PromoCode';          -- attendu: les 2 policies
SELECT column_name FROM information_schema.columns WHERE table_name = 'Order' AND column_name IN ('promoCode','promoDiscount','pointsUsed','pointsDiscount'); -- attendu: 4 lignes
```

Lancer `mcp__supabase__get_advisors` (type security) : aucune NOUVELLE advisory concernant `PromoCode` (les 4 advisories `current_role`/`current_tenant_id` préexistantes restent, acceptées au sous-projet 1).

- [ ] **Step 4: Régénérer et vérifier**

Run: `npx prisma generate && npm run typecheck && npm run test`
Expected: generate OK, typecheck propre, 182/182.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260720150000_promo_codes_and_order_discounts
git commit -m "feat(promos): PromoCode model, Order discount columns, RLS policies"
```

---

### Task 2: Fidélité — le solde de points remplace la dérivation

**Files:**
- Modify: `lib/customers/loyalty.ts` (refonte)
- Modify: `lib/customers/loyalty.test.ts` (refonte)
- Modify: `lib/customers/applyLoyaltyOrder.ts` (crédit/débit du solde, param `pointsToDebit`)
- Modify: `lib/pos/actions.ts` (appel : `pointsToDebit: 0` pour l'instant)
- Modify: `lib/orders/actions.ts` (appel `confirmOrder` : `pointsToDebit: 0` pour l'instant)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces (consommés par Tasks 3, 6, 8) :

```ts
// lib/customers/loyalty.ts
export const POINTS_PER_FCFA_UNIT = 1000;
export const POINT_VALUE_FCFA = 50;
export const VIP_THRESHOLD_SPENT_FCFA = 150_000;
export function pointsEarnedFor(paidTotal: number): number; // ⌊paidTotal / 1000⌋, jamais négatif
export function computeLoyaltyStatus(totalSpent: number, ordersCount: number): { vip: boolean; segment: "VIP" | "Fidele" | "Nouvelle" };

// lib/customers/applyLoyaltyOrder.ts — signature étendue :
// params += { pointsToDebit: number }  (obligatoire, 0 = aucun débit)
// retour inchangé : { customerId, vipBefore, pointsEarned, newBalance }
// sémantique : newBalance = max(0, existing.points + pointsEarnedFor(orderTotal) − pointsToDebit)
```

- [ ] **Step 1: Refondre les tests de fidélité (échec attendu)**

Remplacer intégralement `lib/customers/loyalty.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  computeLoyaltyStatus,
  pointsEarnedFor,
  POINT_VALUE_FCFA,
  VIP_THRESHOLD_SPENT_FCFA,
} from "@/lib/customers/loyalty";

describe("pointsEarnedFor", () => {
  it("credits one point per 1 000 FCFA paid, rounded down", () => {
    expect(pointsEarnedFor(54500)).toBe(54);
    expect(pointsEarnedFor(999)).toBe(0);
  });

  it("never returns a negative credit", () => {
    expect(pointsEarnedFor(0)).toBe(0);
  });
});

describe("computeLoyaltyStatus", () => {
  it("marks a customer VIP once lifetime spend reaches the threshold", () => {
    const result = computeLoyaltyStatus(VIP_THRESHOLD_SPENT_FCFA, 5);
    expect(result.vip).toBe(true);
    expect(result.segment).toBe("VIP");
  });

  it("stays non-VIP just under the threshold", () => {
    expect(computeLoyaltyStatus(VIP_THRESHOLD_SPENT_FCFA - 1000, 5).vip).toBe(false);
  });

  it("segments a first-time customer as Nouvelle", () => {
    expect(computeLoyaltyStatus(12500, 1).segment).toBe("Nouvelle");
  });

  it("segments a repeat non-VIP customer as Fidele", () => {
    expect(computeLoyaltyStatus(50000, 2).segment).toBe("Fidele");
  });

  it("labels a VIP customer VIP even on their first order", () => {
    expect(computeLoyaltyStatus(200000, 1).segment).toBe("VIP");
  });
});

describe("constants", () => {
  it("one point is worth 50 FCFA when redeemed", () => {
    expect(POINT_VALUE_FCFA).toBe(50);
  });
});
```

Run: `npx vitest run lib/customers/loyalty.test.ts` → FAIL (exports inexistants).

- [ ] **Step 2: Refondre `lib/customers/loyalty.ts`**

```ts
/** 1 point gagné par tranche de 1 000 FCFA réellement payés (constante métier, non éditable en v1). */
export const POINTS_PER_FCFA_UNIT = 1000;
/** Valeur d'un point à l'utilisation : 50 FCFA de remise (constante métier, non éditable en v1). */
export const POINT_VALUE_FCFA = 50;
/**
 * Seuil VIP : 150 000 FCFA dépensés à vie — équivalent exact de l'ancien seuil
 * « 150 points » du temps où les points étaient dérivés de totalSpent. Le statut
 * VIP est découplé du solde : dépenser ses points ne le fait jamais perdre.
 */
export const VIP_THRESHOLD_SPENT_FCFA = 150_000;

export type CustomerLoyaltySegment = "VIP" | "Fidele" | "Nouvelle";

/** Points crédités par une vente, sur le montant réellement payé. */
export function pointsEarnedFor(paidTotal: number): number {
  return Math.max(0, Math.floor(paidTotal / POINTS_PER_FCFA_UNIT));
}

/** Statut VIP + segment, dérivés du cumul dépensé à vie (jamais du solde de points). */
export function computeLoyaltyStatus(
  totalSpent: number,
  ordersCount: number
): { vip: boolean; segment: CustomerLoyaltySegment } {
  const vip = totalSpent >= VIP_THRESHOLD_SPENT_FCFA;
  const segment: CustomerLoyaltySegment = vip ? "VIP" : ordersCount === 1 ? "Nouvelle" : "Fidele";
  return { vip, segment };
}
```

(L'ancien `computeLoyalty(totalSpent, ordersCount)` disparaît — la Task met à jour son seul consommateur, `applyLoyaltyOrder`, à l'étape suivante ; vérifier avec `grep -rn "computeLoyalty\b" lib components app --include="*.ts*"` qu'aucun autre appelant n'existe.)

- [ ] **Step 3: Mettre à jour `applyLoyaltyOrder`**

Dans `lib/customers/applyLoyaltyOrder.ts` : remplacer l'import et ajouter `pointsToDebit` :

```ts
import { computeLoyaltyStatus, pointsEarnedFor } from "./loyalty";
```

`ApplyLoyaltyOrderParams` gagne :

```ts
  /** Points à débiter du solde dans la même transaction (0 = aucun débit). */
  pointsToDebit: number;
```

Branche `customerId` (cliente connue) — remplacer le calcul et l'update par :

```ts
    const newOrdersCount = existing.ordersCount + 1;
    const newTotalSpent = existing.totalSpent + orderTotal;
    const earned = pointsEarnedFor(orderTotal);
    const newBalance = Math.max(0, existing.points + earned - params.pointsToDebit);
    const { vip, segment } = computeLoyaltyStatus(newTotalSpent, newOrdersCount);
    const updated = await tx.customer.update({
      where: { id: existing.id },
      data: { ordersCount: newOrdersCount, totalSpent: newTotalSpent, points: newBalance, vip, segment },
    });
    return { customerId: updated.id, vipBefore: existing.vip, pointsEarned: earned, newBalance };
```

Branche web (matching téléphone) — même logique :

```ts
  const newOrdersCount = (existing?.ordersCount ?? 0) + 1;
  const newTotalSpent = (existing?.totalSpent ?? 0) + orderTotal;
  const earned = pointsEarnedFor(orderTotal);
  const newBalance = Math.max(0, (existing?.points ?? 0) + earned - params.pointsToDebit);
  const { vip, segment } = computeLoyaltyStatus(newTotalSpent, newOrdersCount);
```

puis dans les `data` du `update`/`create`, remplacer `points, vip, segment` par `points: newBalance, vip, segment`, et le `return` final par :

```ts
  return { customerId: customer.id, vipBefore: existing?.vip ?? false, pointsEarned: earned, newBalance };
```

- [ ] **Step 4: Mettre à jour les deux appelants (comportement inchangé)**

Dans `lib/pos/actions.ts` (appel `applyLoyaltyOrder`) et `lib/orders/actions.ts` (`confirmOrder`), ajouter `pointsToDebit: 0,` aux params. (Les vrais débits arrivent aux Tasks 6 et 8.)

- [ ] **Step 5: Vérifier**

Run: `npx vitest run lib/customers/loyalty.test.ts` → PASS (8/8).
Run: `npm run typecheck && npm run test` → propre, tout vert.

- [ ] **Step 6: Commit**

```bash
git add lib/customers/loyalty.ts lib/customers/loyalty.test.ts lib/customers/applyLoyaltyOrder.ts lib/pos/actions.ts lib/orders/actions.ts
git commit -m "refactor(loyalty): points become a spendable balance, VIP derived from lifetime spend"
```

---

### Task 3: Moteur de remises pur (TDD)

**Files:**
- Create: `lib/discounts/engine.ts`
- Create: `lib/discounts/engine.test.ts`

**Interfaces:**
- Consumes: `POINT_VALUE_FCFA` (Task 2).
- Produces (consommés par Tasks 4, 6, 8) :

```ts
export interface PromoRule {
  kind: "percent" | "amount";
  value: number;
  minTotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  vipOnly: boolean;
  active: boolean;
}
export function validatePromo(
  promo: PromoRule | null,
  ctx: { now: Date; subtotal: number; isVip: boolean }
): { ok: true } | { ok: false; reason: string };
export function applyDiscounts(input: {
  subtotal: number;
  promo?: PromoRule | null; // supposé déjà validé ; null/absent = pas de promo
  pointsRequested: number;
  pointsBalance: number;
}): { promoDiscount: number; pointsUsed: number; pointsDiscount: number; total: number };
```

- [ ] **Step 1: Écrire les tests (échec attendu)**

`lib/discounts/engine.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { validatePromo, applyDiscounts, type PromoRule } from "./engine";

const base: PromoRule = {
  kind: "percent", value: 10, minTotal: null, startsAt: null, endsAt: null, vipOnly: false, active: true,
};
const now = new Date(2026, 6, 20, 12, 0);

describe("validatePromo", () => {
  it("accepte un code actif sans contrainte", () => {
    expect(validatePromo(base, { now, subtotal: 10000, isVip: false })).toEqual({ ok: true });
  });
  it("refuse un code inconnu (null)", () => {
    expect(validatePromo(null, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code inconnu ou inactif" });
  });
  it("refuse un code inactif", () => {
    expect(validatePromo({ ...base, active: false }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code inconnu ou inactif" });
  });
  it("refuse un code pas encore actif", () => {
    expect(validatePromo({ ...base, startsAt: new Date(2026, 6, 21) }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code pas encore actif" });
  });
  it("refuse un code expiré", () => {
    expect(validatePromo({ ...base, endsAt: new Date(2026, 6, 19) }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Code expiré" });
  });
  it("refuse sous l'achat minimum, avec le montant dans le message", () => {
    expect(validatePromo({ ...base, minTotal: 25000 }, { now, subtotal: 24999, isVip: false })).toEqual({ ok: false, reason: "Achat minimum de 25 000 FCFA non atteint" });
  });
  it("accepte à l'achat minimum exact", () => {
    expect(validatePromo({ ...base, minTotal: 25000 }, { now, subtotal: 25000, isVip: false })).toEqual({ ok: true });
  });
  it("refuse un code VIP pour une cliente non VIP, l'accepte pour une VIP", () => {
    expect(validatePromo({ ...base, vipOnly: true }, { now, subtotal: 10000, isVip: false })).toEqual({ ok: false, reason: "Réservé aux clientes VIP" });
    expect(validatePromo({ ...base, vipOnly: true }, { now, subtotal: 10000, isVip: true })).toEqual({ ok: true });
  });
});

describe("applyDiscounts", () => {
  it("applique un pourcentage arrondi au FCFA", () => {
    const r = applyDiscounts({ subtotal: 32500, promo: base, pointsRequested: 0, pointsBalance: 0 });
    expect(r).toEqual({ promoDiscount: 3250, pointsUsed: 0, pointsDiscount: 0, total: 29250 });
  });
  it("plafonne un montant fixe au sous-total", () => {
    const r = applyDiscounts({ subtotal: 3000, promo: { ...base, kind: "amount", value: 5000 }, pointsRequested: 0, pointsBalance: 0 });
    expect(r).toEqual({ promoDiscount: 3000, pointsUsed: 0, pointsDiscount: 0, total: 0 });
  });
  it("cumule promo puis points sur le restant", () => {
    const r = applyDiscounts({ subtotal: 32500, promo: base, pointsRequested: 20, pointsBalance: 96 });
    expect(r).toEqual({ promoDiscount: 3250, pointsUsed: 20, pointsDiscount: 1000, total: 28250 });
  });
  it("plafonne les points au solde disponible", () => {
    const r = applyDiscounts({ subtotal: 32500, promo: null, pointsRequested: 100, pointsBalance: 12 });
    expect(r.pointsUsed).toBe(12);
    expect(r.pointsDiscount).toBe(600);
    expect(r.total).toBe(31900);
  });
  it("plafonne les points au restant à payer (jamais de total négatif, aucun point gâché)", () => {
    const r = applyDiscounts({ subtotal: 1000, promo: null, pointsRequested: 100, pointsBalance: 100 });
    expect(r.pointsUsed).toBe(20); // 20 × 50 = 1 000, pas un point de plus
    expect(r.total).toBe(0);
  });
  it("ignore les demandes de points négatives", () => {
    const r = applyDiscounts({ subtotal: 5000, promo: null, pointsRequested: -5, pointsBalance: 50 });
    expect(r.pointsUsed).toBe(0);
    expect(r.total).toBe(5000);
  });
  it("sans promo ni points, total = sous-total", () => {
    expect(applyDiscounts({ subtotal: 12500, pointsRequested: 0, pointsBalance: 0 })).toEqual({ promoDiscount: 0, pointsUsed: 0, pointsDiscount: 0, total: 12500 });
  });
});
```

Run: `npx vitest run lib/discounts/engine.test.ts` → FAIL (module inexistant).

- [ ] **Step 2: Implémenter `lib/discounts/engine.ts`**

```ts
import { POINT_VALUE_FCFA } from "@/lib/customers/loyalty";
import { money } from "@/lib/format";

export interface PromoRule {
  kind: "percent" | "amount";
  value: number;
  minTotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  vipOnly: boolean;
  active: boolean;
}

/** Valide un code contre son contexte d'usage. Raisons en FR, affichées telles quelles. */
export function validatePromo(
  promo: PromoRule | null,
  ctx: { now: Date; subtotal: number; isVip: boolean }
): { ok: true } | { ok: false; reason: string } {
  if (!promo || !promo.active) return { ok: false, reason: "Code inconnu ou inactif" };
  if (promo.startsAt && ctx.now < promo.startsAt) return { ok: false, reason: "Code pas encore actif" };
  if (promo.endsAt && ctx.now > promo.endsAt) return { ok: false, reason: "Code expiré" };
  if (promo.minTotal !== null && ctx.subtotal < promo.minTotal) {
    return { ok: false, reason: `Achat minimum de ${money(promo.minTotal)} non atteint` };
  }
  if (promo.vipOnly && !ctx.isVip) return { ok: false, reason: "Réservé aux clientes VIP" };
  return { ok: true };
}

/**
 * Cumul des remises : promo d'abord, points ensuite sur le restant.
 * Les points sont plafonnés au solde ET au restant (total jamais négatif,
 * aucun point converti au-delà du montant à payer).
 */
export function applyDiscounts(input: {
  subtotal: number;
  promo?: PromoRule | null;
  pointsRequested: number;
  pointsBalance: number;
}): { promoDiscount: number; pointsUsed: number; pointsDiscount: number; total: number } {
  const promoDiscount = !input.promo
    ? 0
    : input.promo.kind === "percent"
      ? Math.round((input.subtotal * input.promo.value) / 100)
      : Math.min(input.promo.value, input.subtotal);
  const remaining = input.subtotal - promoDiscount;
  const pointsUsed = Math.min(
    Math.max(0, Math.floor(input.pointsRequested)),
    Math.max(0, input.pointsBalance),
    Math.floor(remaining / POINT_VALUE_FCFA)
  );
  const pointsDiscount = pointsUsed * POINT_VALUE_FCFA;
  return { promoDiscount, pointsUsed, pointsDiscount, total: remaining - pointsDiscount };
}
```

Nota : le test « Achat minimum de 25 000 FCFA non atteint » suppose `money(25000)` → `"25 000 FCFA"` (comportement vérifié au lot 2). Si l'assertion échoue sur le format, aligner l'assertion sur la sortie réelle de `money` — pas de formatage maison.

- [ ] **Step 3: Vérifier puis committer**

Run: `npx vitest run lib/discounts/engine.test.ts` → PASS (15/15). `npm run typecheck` → propre.

```bash
git add lib/discounts/engine.ts lib/discounts/engine.test.ts
git commit -m "feat(discounts): pure promo validation and discount stacking engine"
```

---

### Task 4: Validator promo + lectures + actions Marketing

**Files:**
- Create: `lib/validators/promo.ts`
- Create: `lib/validators/promo.test.ts`
- Create: `lib/data/promos.server.ts`
- Create: `lib/marketing/actions.ts`

**Interfaces:**
- Consumes: model Prisma `PromoCode` (Task 1).
- Produces (consommés par Tasks 5, 6, 8) :

```ts
// lib/validators/promo.ts
export const promoCreateSchema: z.ZodType<...>; // voir Step 1
export type PromoCreateInput = z.infer<typeof promoCreateSchema>;

// lib/data/promos.server.ts
export interface PromoCodeView {
  id: string; code: string; kind: "percent" | "amount"; value: number;
  minTotal: number | null; startsAt: string | null; endsAt: string | null; // ISO ou null
  vipOnly: boolean; active: boolean; usedCount: number;
}
export async function getPromoCodes(): Promise<PromoCodeView[]>; // tenant courant, plus récents d'abord
export async function findPromoByCode(tx: Prisma.TransactionClient | typeof prisma, tenantId: string, code: string): Promise<PromoCode | null>; // lookup par code normalisé MAJUSCULES

// lib/marketing/actions.ts
export async function createPromoCode(input: PromoCreateInput): Promise<{ ok: true } | { ok: false; error: string }>;
export async function setPromoCodeActive(id: string, active: boolean): Promise<{ ok: true } | { ok: false; error: string }>;
```

- [ ] **Step 1: Tests du validator (échec attendu)**

`lib/validators/promo.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { promoCreateSchema } from "./promo";

const valid = { code: "teranga10", kind: "percent", value: 10, vipOnly: false };

describe("promoCreateSchema", () => {
  it("accepte un code valide et le normalise en majuscules", () => {
    const r = promoCreateSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("TERANGA10");
  });
  it("refuse un code trop court ou avec caractères invalides", () => {
    expect(promoCreateSchema.safeParse({ ...valid, code: "AB" }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...valid, code: "TER ANGA" }).success).toBe(false);
  });
  it("borne percent à 1-100", () => {
    expect(promoCreateSchema.safeParse({ ...valid, value: 0 }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...valid, value: 101 }).success).toBe(false);
    expect(promoCreateSchema.safeParse({ ...valid, value: 100 }).success).toBe(true);
  });
  it("accepte un montant fixe positif", () => {
    expect(promoCreateSchema.safeParse({ ...valid, kind: "amount", value: 2000 }).success).toBe(true);
    expect(promoCreateSchema.safeParse({ ...valid, kind: "amount", value: 0 }).success).toBe(false);
  });
  it("refuse une période incohérente (fin avant début)", () => {
    const r = promoCreateSchema.safeParse({ ...valid, startsAt: "2026-07-20", endsAt: "2026-07-10" });
    expect(r.success).toBe(false);
  });
  it("accepte les dates optionnelles absentes", () => {
    expect(promoCreateSchema.safeParse(valid).success).toBe(true);
  });
});
```

Run: `npx vitest run lib/validators/promo.test.ts` → FAIL.

- [ ] **Step 2: Implémenter `lib/validators/promo.ts`**

```ts
import { z } from "zod";

/** Champs de création d'un code promo (écran Marketing). Dates au format YYYY-MM-DD (input date natif). */
export const promoCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "3 à 20 lettres ou chiffres, sans espace.")),
    kind: z.enum(["percent", "amount"]),
    value: z.coerce.number().int().positive(),
    minTotal: z.coerce.number().int().positive().optional(),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    vipOnly: z.boolean().default(false),
  })
  .refine((d) => d.kind !== "percent" || (d.value >= 1 && d.value <= 100), {
    message: "Un pourcentage doit être entre 1 et 100.",
    path: ["value"],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt <= d.endsAt, {
    message: "La fin doit être après le début.",
    path: ["endsAt"],
  });

export type PromoCreateInput = z.input<typeof promoCreateSchema>;
```

Run: `npx vitest run lib/validators/promo.test.ts` → PASS (6/6).

- [ ] **Step 3: Implémenter `lib/data/promos.server.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { Prisma, PromoCode } from "@/lib/generated/prisma/client";

export interface PromoCodeView {
  id: string;
  code: string;
  kind: "percent" | "amount";
  value: number;
  minTotal: number | null;
  startsAt: string | null;
  endsAt: string | null;
  vipOnly: boolean;
  active: boolean;
  usedCount: number;
}

function toView(row: PromoCode): PromoCodeView {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    value: row.value,
    minTotal: row.minTotal,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    vipOnly: row.vipOnly,
    active: row.active,
    usedCount: row.usedCount,
  };
}

/** Codes promo du tenant courant, plus récents d'abord (écran Marketing). */
export async function getPromoCodes(): Promise<PromoCodeView[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.promoCode.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/** Lookup d'un code (normalisé MAJUSCULES) — utilisable dans ou hors transaction. */
export async function findPromoByCode(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  code: string
): Promise<PromoCode | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return db.promoCode.findFirst({ where: { tenantId, code: normalized } });
}
```

- [ ] **Step 4: Implémenter `lib/marketing/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { promoCreateSchema, type PromoCreateInput } from "@/lib/validators/promo";

/** Fin de journée locale pour une date AAAA-MM-JJ (un code « jusqu'au 24/07 » vaut toute la journée du 24). */
function endOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999`);
}

export async function createPromoCode(
  input: PromoCreateInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = promoCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();
    const existing = await prisma.promoCode.findFirst({
      where: { tenantId: tenant.id, code: parsed.data.code },
    });
    if (existing) return { ok: false, error: "Ce code existe déjà." };

    await prisma.promoCode.create({
      data: {
        tenantId: tenant.id,
        code: parsed.data.code,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minTotal: parsed.data.minTotal ?? null,
        startsAt: parsed.data.startsAt ? new Date(`${parsed.data.startsAt}T00:00:00`) : null,
        endsAt: parsed.data.endsAt ? endOfDay(parsed.data.endsAt) : null,
        vipOnly: parsed.data.vipOnly,
      },
    });
    revalidatePath("/marketing");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function setPromoCodeActive(
  id: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const promo = await prisma.promoCode.findFirst({ where: { id, tenantId: tenant.id } });
    if (!promo) return { ok: false, error: "Code introuvable." };
    await prisma.promoCode.update({ where: { id: promo.id }, data: { active } });
    revalidatePath("/marketing");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 5: Vérifier puis committer**

Run: `npm run typecheck && npm run test` → propre, tout vert.

```bash
git add lib/validators/promo.ts lib/validators/promo.test.ts lib/data/promos.server.ts lib/marketing/actions.ts
git commit -m "feat(promos): promo validator, tenant-scoped reads and marketing server actions"
```

---

### Task 5: Écran Marketing — carte Promotions réelle

**Files:**
- Modify: `app/(dashboard)/marketing/page.tsx` (fetch `getPromoCodes()` en plus du catalogue)
- Modify: `components/dashboard/screens/MarketingScreen.tsx` (constante `PROMOS` supprimée ; liste + formulaire branchés)

**Interfaces:**
- Consumes: `getPromoCodes`/`PromoCodeView` (Task 4), `createPromoCode`/`setPromoCodeActive` (Task 4), `useBackoffice.showToast` (existant), `NumericField` (existant, `components/ui/NumericField`).
- Produces: `MarketingScreen({ products, promos }: { products: Product[]; promos: PromoCodeView[] })` — signature consommée par la page. Les cartes Stars/Dormants/MiniKpi restent mockées (périmètre du Lot 4).

- [ ] **Step 1: Page serveur**

`app/(dashboard)/marketing/page.tsx` :

```tsx
import { getCatalog } from "@/lib/data/catalog.server";
import { getPromoCodes } from "@/lib/data/promos.server";
import { MarketingScreen } from "@/components/dashboard/screens/MarketingScreen";

export default async function MarketingPage() {
  const [products, promos] = await Promise.all([getCatalog(), getPromoCodes()]);
  return <MarketingScreen products={products} promos={promos} />;
}
```

(Si la page actuelle diffère légèrement, conserver sa structure et ajouter seulement le fetch + la prop.)

- [ ] **Step 2: Brancher la liste des codes**

Dans `MarketingScreen.tsx` : supprimer la constante `PROMOS` ; signature `{ products, promos }: { products: Product[]; promos: PromoCodeView[] }` avec `import type { PromoCodeView } from "@/lib/data/promos.server";` et `import { createPromoCode, setPromoCodeActive } from "@/lib/marketing/actions";`. Le composant passe en état local pour le formulaire (il est déjà `"use client"`).

Remplacer le bloc « Codes promo actifs » (le `.map` sur `PROMOS`) par un rendu sur `promos` — mêmes styles, en dérivant l'affichage :

```tsx
{promos.length === 0 && (
  <p style={{ fontSize: 13, color: colors.muted, padding: "10px 0" }}>Aucun code pour l'instant — créez le premier ci-contre.</p>
)}
{promos.map((pr) => (
  <div key={pr.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${colors.faintLine}`, opacity: pr.active ? 1 : 0.55 }}>
    <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: 13, background: colors.ink, color: colors.gold, padding: "5px 10px", borderRadius: 8 }}>
      {pr.code}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{promoDesc(pr)}</div>
      <div style={{ fontSize: 11.5, color: colors.muted }}>{promoPeriod(pr)}</div>
    </div>
    <span style={{ font: `600 11px ${fonts.ui}`, background: colors.bgSuccess, color: colors.fgSuccess, padding: "3px 9px", borderRadius: 999 }}>
      {pr.usedCount} util.
    </span>
    <button
      onClick={async () => {
        const r = await setPromoCodeActive(pr.id, !pr.active);
        if (!r.ok) showToast(r.error, "error");
      }}
      style={{ height: 30, padding: "0 11px", border: `1.5px solid ${colors.borderField}`, borderRadius: 8, background: "#fff", font: `600 12px ${fonts.ui}`, color: pr.active ? colors.muted : colors.fgSuccess, cursor: "pointer" }}
    >
      {pr.active ? "Désactiver" : "Activer"}
    </button>
  </div>
))}
```

avec les helpers en bas de fichier (et `import { money } from "@/lib/format";` déjà présent) :

```tsx
function promoDesc(pr: PromoCodeView): string {
  const remise = pr.kind === "percent" ? `−${pr.value}%` : `−${money(pr.value)}`;
  const min = pr.minTotal ? ` dès ${money(pr.minTotal)}` : "";
  const cible = pr.vipOnly ? " · clientes VIP" : "";
  return `${remise}${min}${cible}`;
}
function promoPeriod(pr: PromoCodeView): string {
  const f = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
  if (pr.startsAt && pr.endsAt) return `${f(pr.startsAt)} → ${f(pr.endsAt)}`;
  if (pr.endsAt) return `Jusqu'au ${f(pr.endsAt)}`;
  if (pr.startsAt) return `À partir du ${f(pr.startsAt)}`;
  return "Permanent";
}
```

`showToast` vient de `useBackoffice((s) => s.showToast)` (`import { useBackoffice } from "@/lib/store/useBackoffice";`).

- [ ] **Step 3: Brancher le formulaire « Créer un code promo »**

Remplacer les inputs `defaultValue` par un état contrôlé + soumission :

```tsx
const [form, setForm] = useState({ code: "", kind: "percent" as "percent" | "amount", value: 10, minTotal: 0, startsAt: "", endsAt: "", vipOnly: false });
const [saving, setSaving] = useState(false);

async function handleCreate() {
  setSaving(true);
  const r = await createPromoCode({
    code: form.code,
    kind: form.kind,
    value: form.value,
    minTotal: form.minTotal > 0 ? form.minTotal : undefined,
    startsAt: form.startsAt || undefined,
    endsAt: form.endsAt || undefined,
    vipOnly: form.vipOnly,
  });
  setSaving(false);
  if (!r.ok) { showToast(r.error, "error"); return; }
  showToast("Code promo créé.", "success");
  setForm({ code: "", kind: "percent", value: 10, minTotal: 0, startsAt: "", endsAt: "", vipOnly: false });
}
```

Champs (mêmes styles existants `fieldLabel`/`textField`/`suffixField`/`bareInput`/`Select` remplacé par un `<select>` contrôlé) :
- Code : `<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="TERANGA10" style={…existant} />`
- Type : `<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "amount" })}>` avec options `percent → "Pourcentage"`, `amount → "Montant fixe"`.
- Valeur : `<NumericField mode="integer" value={form.value} onChange={(v) => setForm({ ...form, value: v })} min={1} max={form.kind === "percent" ? 100 : undefined} />` avec suffixe affiché `%` ou `FCFA` selon `form.kind`.
- Achat minimum (nouveau champ, optionnel) : `<NumericField mode="money" value={form.minTotal} onChange={(v) => setForm({ ...form, minTotal: v })} min={0} placeholder="0 = aucun" />`.
- Début / Fin : `<input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} style={textField} />` (idem `endsAt`).
- Cible : `<select value={form.vipOnly ? "vip" : "all"} onChange={(e) => setForm({ ...form, vipOnly: e.target.value === "vip" })}>` avec « Toutes les clientes » / « Clientes VIP » (l'option mock « Clientes dormantes » disparaît — hors spec v1).
- Bouton : `onClick={handleCreate}`, `disabled={saving || !form.code}`, libellé `saving ? "Création…" : "Créer le code promo"`.

`import { NumericField } from "@/components/ui/NumericField";` et `import { useState } from "react";` si absents.

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run test` → propre.

Navigateur (si session owner disponible ; sinon consigner pour la vérification finale) : `/admin/marketing` — créer `TERANGA10` (−10%, min 25 000, permanent) → apparaît dans la liste avec « 0 util. » ; le désactiver → opacité réduite + bouton « Activer » ; doublon → toast « Ce code existe déjà. ».

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/marketing/page.tsx components/dashboard/screens/MarketingScreen.tsx
git commit -m "feat(marketing): real promo codes list, create form and active toggle"
```

---

### Task 6: POS serveur — promo + points dans `encaisserVente`

**Files:**
- Modify: `lib/validators/pos.ts` (+ `promoCode`, `pointsRequested`)
- Modify: `lib/validators/pos.test.ts`
- Create: `lib/discounts/actions.ts` (action de prévisualisation POS)
- Modify: `lib/pos/actions.ts` (intégration moteur + débits + ticket)
- Modify: `lib/pos/ticketMessage.ts` (+ lignes promo/points)
- Modify: `lib/pos/ticketMessage.test.ts`

**Interfaces:**
- Consumes: `validatePromo`/`applyDiscounts`/`PromoRule` (Task 3), `findPromoByCode` (Task 4), `applyLoyaltyOrder` avec `pointsToDebit` (Task 2), `POINT_VALUE_FCFA` (Task 2).
- Produces (consommés par Task 7) :

```ts
// lib/validators/pos.ts — posSaleSchema gagne :
//   promoCode: z.string().trim().optional(),
//   pointsRequested: z.coerce.number().int().min(0).default(0),

// lib/discounts/actions.ts
export interface DiscountPreview {
  promo: { code: string; discount: number } | null;
  promoError: string | null; // raison FR si le code saisi est invalide
  pointsUsed: number;
  pointsDiscount: number;
  total: number;
  subtotal: number;
}
export async function previewPosDiscount(input: {
  subtotal: number; promoCode?: string; pointsRequested: number; customerId?: string | null;
}): Promise<{ ok: true; preview: DiscountPreview } | { ok: false; error: string }>; // requireZone("dashboard")

// lib/pos/actions.ts — PosTicketData gagne :
//   promo: { code: string; discount: number } | null;
//   pointsUsed: { points: number; discount: number } | null;

// lib/pos/ticketMessage.ts — TicketMessageInput gagne :
//   promo: { code: string; discount: number } | null;
//   pointsUsed: { points: number; discount: number } | null;
// rendu : « Code promo X : −… » et « Points utilisés (n) : −… » entre Sous-total et Total,
// le bloc Sous-total apparaît dès qu'une remise (ligne, promo ou points) existe.
```

- [ ] **Step 1: Tests validator (échec attendu)**

Ajouter à `lib/validators/pos.test.ts` :

```ts
describe("posSaleSchema — remises", () => {
  it("accepte promoCode et pointsRequested optionnels", () => {
    const r = posSaleSchema.safeParse({ ...base, paymentMethod: "espece", promoCode: " teranga10 ", pointsRequested: 20 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.promoCode).toBe("teranga10"); // trim seul — la normalisation MAJUSCULES vit côté lookup
      expect(r.data.pointsRequested).toBe(20);
    }
  });
  it("refuse des points négatifs et défaut 0", () => {
    expect(posSaleSchema.safeParse({ ...base, paymentMethod: "espece", pointsRequested: -1 }).success).toBe(false);
    const r = posSaleSchema.safeParse({ ...base, paymentMethod: "espece" });
    expect(r.success && r.data.pointsRequested === 0).toBe(true);
  });
});
```

Run → FAIL. Implémenter dans `lib/validators/pos.ts` (dans `posSaleSchema`) :

```ts
  promoCode: z.string().trim().optional(),
  pointsRequested: z.coerce.number().int().min(0).default(0),
```

Run → PASS.

- [ ] **Step 2: Tests ticketMessage (échec attendu) puis implémentation**

Ajouter à `lib/pos/ticketMessage.test.ts` (adapter `base` : les nouveaux champs `promo: null, pointsUsed: null` s'ajoutent à toutes les entrées existantes) :

```ts
it("affiche les lignes promo et points avec le sous-total", () => {
  const msg = buildTicketMessage({
    ...base,
    promo: { code: "TERANGA10", discount: 3250 },
    pointsUsed: { points: 20, discount: 1000 },
    total: 28250,
  });
  expect(msg).toContain("Sous-total : 32 500 FCFA");
  expect(msg).toContain("Code promo TERANGA10 : −3 250 FCFA");
  expect(msg).toContain("Points utilisés (20) : −1 000 FCFA");
  expect(msg).toContain("*Total payé : 28 250 FCFA*");
});
```

Dans `lib/pos/ticketMessage.ts` : `TicketMessageInput` gagne `promo: { code: string; discount: number } | null;` et `pointsUsed: { points: number; discount: number } | null;`. Le bloc de rendu remplace la condition `if (input.discount > 0)` par :

```ts
  const hasAnyDiscount = input.discount > 0 || input.promo !== null || input.pointsUsed !== null;
  if (hasAnyDiscount) parts.push(`Sous-total : ${money(input.subtotal)}`);
  if (input.discount > 0) parts.push(`Remise : −${money(input.discount)}`);
  if (input.promo) parts.push(`Code promo ${input.promo.code} : −${money(input.promo.discount)}`);
  if (input.pointsUsed) parts.push(`Points utilisés (${input.pointsUsed.points}) : −${money(input.pointsUsed.discount)}`);
```

Run: `npx vitest run lib/pos/ticketMessage.test.ts` → PASS (7/7 — les tests existants passent avec `promo: null, pointsUsed: null` ajoutés à leurs entrées).

- [ ] **Step 3: Intégrer le moteur dans `encaisserVente`**

Dans `lib/pos/actions.ts` — imports ajoutés :

```ts
import { validatePromo, applyDiscounts } from "@/lib/discounts/engine";
import { findPromoByCode } from "@/lib/data/promos.server";
```

`PosTicketData` gagne :

```ts
  promo: { code: string; discount: number } | null;
  pointsUsed: { points: number; discount: number } | null;
```

Dans la transaction, après le calcul de `built` et AVANT la création de l'ordre, remplacer le bloc cliente/loyalty existant par (structure complète) :

```ts
      // Cliente rattachée (facultative) — lue d'abord : ses points/statut VIP
      // conditionnent les remises.
      let customer: Awaited<ReturnType<typeof tx.customer.findFirst>> = null;
      if (parsed.data.customerId) {
        customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, tenantId: tenant.id },
        });
        if (!customer) throw new Error("Cliente introuvable.");
      }

      // Remises : code promo (validé serveur, erreur bloquante si invalide) puis points.
      let promoRow = null;
      if (parsed.data.promoCode) {
        promoRow = await findPromoByCode(tx, tenant.id, parsed.data.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal: built.total,
          isVip: customer?.vip ?? false,
        });
        if (!verdict.ok) throw new Error(`Code promo : ${verdict.reason}.`);
      }
      const discounts = applyDiscounts({
        subtotal: built.total,
        promo: promoRow,
        pointsRequested: customer ? parsed.data.pointsRequested : 0,
        pointsBalance: customer?.points ?? 0,
      });
      if (promoRow && discounts.promoDiscount > 0) {
        await tx.promoCode.update({
          where: { id: promoRow.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      let clientName = "Client comptoir";
      let phone = "";
      let place = "Vente en boutique";
      let customerId: string | null = null;
      let vipAtOrder = false;
      let loyaltyInfo: { pointsEarned: number; newBalance: number } | null = null;

      if (customer) {
        const loyalty = await applyLoyaltyOrder({
          tx,
          tenantId: tenant.id,
          orderTotal: discounts.total, // points gagnés sur le montant réellement payé
          customerId: customer.id,
          pointsToDebit: discounts.pointsUsed,
        });
        customerId = loyalty.customerId;
        vipAtOrder = loyalty.vipBefore;
        loyaltyInfo = { pointsEarned: loyalty.pointsEarned, newBalance: loyalty.newBalance };
        clientName = customer.name;
        phone = customer.phone;
        place = customer.place;
      }
```

La création de l'ordre gagne les colonnes :

```ts
          total: discounts.total,
          promoCode: promoRow && discounts.promoDiscount > 0 ? promoRow.code : null,
          promoDiscount: discounts.promoDiscount,
          pointsUsed: discounts.pointsUsed,
          pointsDiscount: discounts.pointsDiscount,
```

(`total: built.total` disparaît au profit de `discounts.total` ; noter que `totalSpent` de la cliente est incrémenté du montant PAYÉ via `orderTotal: discounts.total`.)

Le retour ticket est complété :

```ts
        total: result.discounts.total,
        promo:
          result.promoRow && result.discounts.promoDiscount > 0
            ? { code: result.promoRow.code, discount: result.discounts.promoDiscount }
            : null,
        pointsUsed:
          result.discounts.pointsUsed > 0
            ? { points: result.discounts.pointsUsed, discount: result.discounts.pointsDiscount }
            : null,
```

(la closure retourne désormais `{ order, built, phone, loyaltyInfo, discounts, promoRow }`). Ajouter `message.startsWith("Code promo : ")` à la liste des erreurs connues du `catch`.

- [ ] **Step 4: Action de prévisualisation POS**

`lib/discounts/actions.ts` :

```ts
"use server";

import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { validatePromo, applyDiscounts } from "./engine";
import { findPromoByCode } from "@/lib/data/promos.server";

export interface DiscountPreview {
  promo: { code: string; discount: number } | null;
  promoError: string | null;
  pointsUsed: number;
  pointsDiscount: number;
  total: number;
  subtotal: number;
}

/** Aperçu de remise pour le POS (lecture seule — aucun débit, aucun compteur). */
export async function previewPosDiscount(input: {
  subtotal: number;
  promoCode?: string;
  pointsRequested: number;
  customerId?: string | null;
}): Promise<{ ok: true; preview: DiscountPreview } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  if (!Number.isFinite(input.subtotal) || input.subtotal < 0) {
    return { ok: false, error: "Montant invalide." };
  }

  try {
    const tenant = await getCurrentTenant();
    const customer = input.customerId
      ? await prisma.customer.findFirst({ where: { id: input.customerId, tenantId: tenant.id } })
      : null;

    let promoRow = null;
    let promoError: string | null = null;
    if (input.promoCode?.trim()) {
      promoRow = await findPromoByCode(prisma, tenant.id, input.promoCode);
      const verdict = validatePromo(promoRow, {
        now: new Date(),
        subtotal: input.subtotal,
        isVip: customer?.vip ?? false,
      });
      if (!verdict.ok) {
        promoError = verdict.reason;
        promoRow = null;
      }
    }

    const d = applyDiscounts({
      subtotal: input.subtotal,
      promo: promoRow,
      pointsRequested: customer ? Math.max(0, Math.floor(input.pointsRequested)) : 0,
      pointsBalance: customer?.points ?? 0,
    });
    return {
      ok: true,
      preview: {
        promo: promoRow && d.promoDiscount > 0 ? { code: promoRow.code, discount: d.promoDiscount } : null,
        promoError,
        pointsUsed: d.pointsUsed,
        pointsDiscount: d.pointsDiscount,
        total: d.total,
        subtotal: input.subtotal,
      },
    };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 5: Vérifier puis committer**

Run: `npm run typecheck && npm run test` → propre, tout vert.

```bash
git add lib/validators/pos.ts lib/validators/pos.test.ts lib/discounts/actions.ts lib/pos/actions.ts lib/pos/ticketMessage.ts lib/pos/ticketMessage.test.ts
git commit -m "feat(pos): promo code and loyalty points redemption in encaisserVente + preview action"
```

---

### Task 7: POS UI — champ promo, points, récapitulatif, ticket

**Files:**
- Modify: `components/dashboard/screens/PosScreen.tsx` (état remises + section dans `CartPanelDesktop` et `CartSheetMobile` + `PayButton`)
- Modify: `lib/store/useBackoffice.ts` (interface `Ticket` : + `promo`, `pointsUsed`)
- Modify: `components/dashboard/TicketModal.tsx` (+ lignes promo/points)

**Interfaces:**
- Consumes: `previewPosDiscount`/`DiscountPreview` (Task 6), `posSaleSchema` étendu (Task 6), `PosTicketData` étendu (Task 6), `buildTicketMessage` étendu (Task 6), `POINT_VALUE_FCFA` (Task 2), `NumericField` (existant).
- Produces: rien en aval.

- [ ] **Step 1: État remises dans `PosScreen`**

Le composant `PosScreen` gagne un état local partagé avec les deux panneaux (le composant parent les rend tous les deux) :

```tsx
const [promoCode, setPromoCode] = useState("");
const [pointsReq, setPointsReq] = useState(0);
const [preview, setPreview] = useState<DiscountPreview | null>(null);
const client = useBackoffice((s) => s.client);

// Re-prévisualiser à chaque changement pertinent (débouncé sur le code).
useEffect(() => {
  const sub = cart.reduce((a, l) => a + (l.price - l.discount) * l.qty, 0);
  if (sub === 0 || (!promoCode.trim() && pointsReq === 0)) { setPreview(null); return; }
  const t = setTimeout(async () => {
    const r = await previewPosDiscount({ subtotal: sub, promoCode: promoCode || undefined, pointsRequested: pointsReq, customerId: client?.id ?? null });
    setPreview(r.ok ? r.preview : null);
  }, 350);
  return () => clearTimeout(t);
}, [cart, promoCode, pointsReq, client]);
```

(imports : `useEffect`, `previewPosDiscount`, `type DiscountPreview` depuis `@/lib/discounts/actions`, `POINT_VALUE_FCFA` depuis `@/lib/customers/loyalty`.) Quand la cliente est détachée (`client` devient null), remettre `setPointsReq(0)`.

Le total affiché devient `preview ? preview.total : total` — passer `promoCode/pointsReq/preview/setPromoCode/setPointsReq` en props aux panneaux et au `PayButton` (types explicites, pas de `any`).

- [ ] **Step 2: Section « Remises » dans les panneaux panier**

Dans `CartPanelDesktop` (juste au-dessus du bloc Sous-total existant) et `CartSheetMobile` (même bloc, mêmes props) :

```tsx
<div style={{ borderTop: `1px solid ${colors.borderSoft}`, paddingTop: 12, marginTop: 12 }}>
  <label style={{ display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 }}>Code promo</label>
  <input
    value={promoCode}
    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
    placeholder="Ex. TERANGA10"
    style={{ width: "100%", height: 40, padding: "0 12px", border: `1.5px solid ${preview?.promoError ? colors.danger : colors.borderField}`, borderRadius: 9, font: "600 13px ui-monospace,monospace", letterSpacing: ".04em", outline: "none" }}
  />
  {preview?.promoError && <p style={{ font: `500 12px ${fonts.ui}`, color: colors.danger, margin: "6px 0 0" }}>{preview.promoError}</p>}
  {client && (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 }}>
        Points de fidélité — solde {client.points} ({money(client.points * POINT_VALUE_FCFA)})
      </label>
      <NumericField mode="integer" value={pointsReq} onChange={setPointsReq} min={0} max={client.points} placeholder="0" />
      {preview && preview.pointsUsed !== pointsReq && pointsReq > 0 && (
        <p style={{ font: `500 12px ${fonts.ui}`, color: colors.muted, margin: "6px 0 0" }}>
          Plafonné à {preview.pointsUsed} points sur cette vente.
        </p>
      )}
    </div>
  )}
</div>
```

Le récapitulatif (bloc Sous-total/Remises/Total existant) gagne deux lignes conditionnelles, entre « Remises » et « Total » :

```tsx
{preview?.promo && (
  <div style={rowStyle}>{/* même style que la ligne Remises existante */}
    <span>Code {preview.promo.code}</span>
    <span>−{money(preview.promo.discount)}</span>
  </div>
)}
{preview && preview.pointsUsed > 0 && (
  <div style={rowStyle}>
    <span>Points ({preview.pointsUsed})</span>
    <span>−{money(preview.pointsDiscount)}</span>
  </div>
)}
```

et le Total affiche `money(preview ? preview.total : total)`.

- [ ] **Step 3: `PayButton` envoie les remises et alimente le ticket**

`handlePay` : l'appel `encaisserVente` gagne `promoCode: promoCode.trim() || undefined, pointsRequested: pointsReq,`. Le `buildTicketMessage` et le `showTicket` gagnent `promo: result.ticket.promo` et `pointsUsed: result.ticket.pointsUsed` (mêmes noms côté `Ticket` du store et `TicketMessageInput`). Après succès : `setPromoCode(""); setPointsReq(0); setPreview(null);`.

Dans `lib/store/useBackoffice.ts`, l'interface `Ticket` gagne :

```ts
  promo: { code: string; discount: number } | null;
  pointsUsed: { points: number; discount: number } | null;
```

Dans `TicketModal.tsx`, sous la ligne `Remise` existante :

```tsx
{ticket.promo && <Row label={`Code ${ticket.promo.code}`} value={`−${money(ticket.promo.discount)}`} />}
{ticket.pointsUsed && <Row label={`Points (${ticket.pointsUsed.points})`} value={`−${money(ticket.pointsUsed.discount)}`} />}
```

et la condition d'affichage du Sous-total devient `(ticket.discount > 0 || ticket.promo || ticket.pointsUsed)`.

- [ ] **Step 4: Vérifier puis committer**

Run: `npm run typecheck && npm run test` → propre.

Navigateur (si session owner ; sinon consigner) : vente avec code valide + points → récapitulatif montre les 3 lignes de remise, ticket et message WhatsApp cohérents ; code invalide → message rouge sous le champ, l'encaissement avec ce code affiche l'erreur serveur.

```bash
git add components/dashboard/screens/PosScreen.tsx lib/store/useBackoffice.ts components/dashboard/TicketModal.tsx
git commit -m "feat(pos): promo and points redemption UI with server-side preview"
```

---

### Task 8: Web serveur — intention à la soumission, débits à la validation

**Files:**
- Modify: `lib/orders/actions.ts` (`submitWebOrder` + `confirmOrder`)
- Create: `lib/discounts/webActions.ts` (préviews côté vitrine)
- Modify: `lib/data/orders.server.ts` (mapping des colonnes de remise + validité promo pour les commandes `nouvelle`)
- Modify: `lib/data/types.ts` (type `Order`)

**Interfaces:**
- Consumes: moteur (Task 3), `findPromoByCode` (Task 4), `applyLoyaltyOrder` `pointsToDebit` (Task 2), `normalizePhone` (existant, `lib/customers/normalizePhone`), `getSession` (existant, `lib/auth`), `getCustomerByProfileId` (existant, `lib/data/customers.server`).
- Produces (consommés par Task 9) :

```ts
// lib/discounts/webActions.ts
export async function previewWebDiscount(input: {
  subtotal: number; promoCode?: string; pointsRequested: number;
}): Promise<{ ok: true; preview: DiscountPreview; customerPoints: number | null } | { ok: false; error: string }>;
// customerPoints = solde de la cliente CONNECTÉE (null si anonyme) ; points ignorés si anonyme.

// lib/orders/actions.ts
export async function submitWebOrder(
  kyc: KycInput,
  cartLines: WebCartLineInput[],
  discounts?: { promoCode?: string; pointsRequested?: number }
): Promise<{ ok: true; ref: string } | { ok: false; error: string }>;

// lib/data/types.ts — interface Order gagne :
//   subtotal: string;           // formaté money — Σ lineTotal
//   promoCode: string | null;
//   promoDiscount: number;      // FCFA bruts (0 = aucune)
//   pointsUsed: number;
//   pointsDiscount: number;
//   promoStillValid: boolean;   // false SEULEMENT pour une commande `nouvelle` dont le code ne passe plus (écart affiché avant validation)
```

- [ ] **Step 1: `previewWebDiscount`**

`lib/discounts/webActions.ts` :

```ts
"use server";

import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { getCustomerByProfileId } from "@/lib/data/customers.server";
import { validatePromo, applyDiscounts } from "./engine";
import { findPromoByCode } from "@/lib/data/promos.server";
import type { DiscountPreview } from "./actions";

/**
 * Aperçu de remise côté vitrine (lecture seule). La cliente n'est JAMAIS
 * désignée par le client : elle est résolue depuis la session serveur.
 * Anonyme : points ignorés, codes VIP refusés.
 */
export async function previewWebDiscount(input: {
  subtotal: number;
  promoCode?: string;
  pointsRequested: number;
}): Promise<{ ok: true; preview: DiscountPreview; customerPoints: number | null } | { ok: false; error: string }> {
  if (!Number.isFinite(input.subtotal) || input.subtotal < 0) {
    return { ok: false, error: "Montant invalide." };
  }
  try {
    const tenant = await getCurrentTenant();
    const session = await getSession();
    const customer =
      session && session.role === "customer" ? await getCustomerByProfileId(session.userId) : null;

    let promoRow = null;
    let promoError: string | null = null;
    if (input.promoCode?.trim()) {
      promoRow = await findPromoByCode(prisma, tenant.id, input.promoCode);
      const verdict = validatePromo(promoRow, {
        now: new Date(),
        subtotal: input.subtotal,
        isVip: customer?.segment === "VIP",
      });
      if (!verdict.ok) {
        promoError = verdict.reason;
        promoRow = null;
      }
    }

    const d = applyDiscounts({
      subtotal: input.subtotal,
      promo: promoRow,
      pointsRequested: customer ? Math.max(0, Math.floor(input.pointsRequested)) : 0,
      pointsBalance: customer?.points ?? 0,
    });
    return {
      ok: true,
      preview: {
        promo: promoRow && d.promoDiscount > 0 ? { code: promoRow.code, discount: d.promoDiscount } : null,
        promoError,
        pointsUsed: d.pointsUsed,
        pointsDiscount: d.pointsDiscount,
        total: d.total,
        subtotal: input.subtotal,
      },
      customerPoints: customer?.points ?? null,
    };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

(Vérifier le type retourné par `getCustomerByProfileId` — le type applicatif `Customer` expose `points` et `segment` (`lib/data/types.ts`) ; si le champ VIP y est un booléen `vip`, utiliser `customer?.vip ?? false`.)

- [ ] **Step 2: `submitWebOrder` — enregistrer l'intention sans rien débiter**

Signature : `submitWebOrder(kyc, cartLines, discounts?: { promoCode?: string; pointsRequested?: number })`. Dans la transaction, après `built` :

```ts
      // Remises DEMANDÉES : aperçu enregistré sur la commande, AUCUN débit
      // (ni points, ni compteur promo, ni stock) avant validation gérante.
      const session = await getSession();
      const customer =
        session && session.role === "customer" ? await getCustomerByProfileId(session.userId) : null;

      let promoRow = null;
      if (discounts?.promoCode?.trim()) {
        promoRow = await findPromoByCode(tx, tenant.id, discounts.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal: built.total,
          isVip: customer?.segment === "VIP",
        });
        if (!verdict.ok) promoRow = null; // code devenu invalide : la demande part sans promo
      }
      const d = applyDiscounts({
        subtotal: built.total,
        promo: promoRow,
        pointsRequested: customer ? Math.max(0, Math.floor(discounts?.pointsRequested ?? 0)) : 0,
        pointsBalance: customer?.points ?? 0,
      });
```

et la création :

```ts
          total: d.total,
          promoCode: promoRow && d.promoDiscount > 0 ? promoRow.code : null,
          promoDiscount: d.promoDiscount,
          pointsUsed: d.pointsUsed,
          pointsDiscount: d.pointsDiscount,
```

(imports ajoutés en tête : `validatePromo`, `applyDiscounts` depuis `@/lib/discounts/engine` ; `findPromoByCode` depuis `@/lib/data/promos.server` ; `getSession` depuis `@/lib/auth` ; `getCustomerByProfileId` depuis `@/lib/data/customers.server` ; `normalizePhone` depuis `@/lib/customers/normalizePhone` pour le Step 3.)

- [ ] **Step 3: `confirmOrder` — re-valider, re-plafonner, débiter**

Dans la transaction de `confirmOrder`, après la déduction de stock et AVANT `applyLoyaltyOrder`, insérer :

```ts
      // Remises : re-validation au moment de la validation (source de vérité).
      // Le sous-total vient des lignes ; la cliente est matchée par téléphone
      // normalisé (même règle que applyLoyaltyOrder) pour connaître solde et VIP.
      const subtotal = order.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const normalized = normalizePhone(order.phone);
      const candidates = await tx.customer.findMany({ where: { tenantId: tenant.id } });
      const matched = candidates.find((c) => normalizePhone(c.phone) === normalized) ?? null;

      let promoRow = null;
      if (order.promoCode) {
        promoRow = await findPromoByCode(tx, tenant.id, order.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal,
          isVip: matched?.vip ?? false,
        });
        if (!verdict.ok) promoRow = null; // code plus valide : commande validée SANS la remise promo
      }
      const d = applyDiscounts({
        subtotal,
        promo: promoRow,
        pointsRequested: order.pointsUsed, // l'intention enregistrée à la soumission
        pointsBalance: matched?.points ?? 0,
      });
      if (promoRow && d.promoDiscount > 0) {
        await tx.promoCode.update({ where: { id: promoRow.id }, data: { usedCount: { increment: 1 } } });
      }
```

puis remplacer l'appel `applyLoyaltyOrder` et l'update final par :

```ts
      const { customerId } = await applyLoyaltyOrder({
        tx,
        tenantId: tenant.id,
        orderTotal: d.total,
        clientName: order.clientName,
        phone: order.phone,
        place: order.place,
        pointsToDebit: d.pointsUsed,
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "confirmee",
          customerId,
          total: d.total,
          promoCode: promoRow && d.promoDiscount > 0 ? promoRow.code : order.promoCode,
          promoDiscount: d.promoDiscount,
          pointsUsed: d.pointsUsed,
          pointsDiscount: d.pointsDiscount,
        },
      });
```

(`order.promoCode` est conservé même si la remise tombe à 0 — trace de ce qui avait été demandé.)

- [ ] **Step 4: Mapping lecture + type `Order`**

`lib/data/types.ts` — dans `interface Order`, ajouter :

```ts
  /** Σ lineTotal, formaté — affiché quand une remise existe. */
  subtotal: string;
  promoCode: string | null;
  promoDiscount: number;
  pointsUsed: number;
  pointsDiscount: number;
  /** false SEULEMENT pour une commande `nouvelle` dont le code ne passe plus (écart à afficher). */
  promoStillValid: boolean;
```

`lib/data/orders.server.ts` — `toOrder` devient `toOrder(row, promoValidity)` avec `promoValidity: Map<string, boolean>` (clé = `row.id`) et mappe :

```ts
    subtotal: money(row.lines.reduce((s, l) => s + l.lineTotal, 0)),
    promoCode: row.promoCode,
    promoDiscount: row.promoDiscount,
    pointsUsed: row.pointsUsed,
    pointsDiscount: row.pointsDiscount,
    promoStillValid: promoValidity.get(row.id) ?? true,
```

`getOrders`/`getOrderByRef` construisent la map : pour chaque commande `status === "nouvelle"` avec `promoCode`, charger une fois les codes du tenant (`prisma.promoCode.findMany({ where: { tenantId } })`) et évaluer `validatePromo(codeTrouvé ?? null, { now, subtotal: Σ lineTotal, isVip: true })` — `isVip: true` volontairement : la vérification VIP réelle a lieu à la validation, on ne signale ici que les invalidités sûres (inactif/expiré/minimum). Import `validatePromo` depuis `@/lib/discounts/engine`.

- [ ] **Step 5: Vérifier puis committer**

Run: `npm run typecheck && npm run test` → propre, tout vert.

```bash
git add lib/orders/actions.ts lib/discounts/webActions.ts lib/data/orders.server.ts lib/data/types.ts
git commit -m "feat(orders): web discounts recorded at submission, revalidated and debited at confirmation"
```

---

### Task 9: Web UI — checkout, écran Commandes

**Files:**
- Modify: `components/storefront/views/CheckoutView.tsx` (champ promo + points si connectée + récapitulatif)
- Modify: `components/dashboard/screens/OrdersScreen.tsx` (lignes de remise + badge écart)

**Interfaces:**
- Consumes: `previewWebDiscount` (Task 8), `submitWebOrder` étendu (Task 8), type `Order` étendu (Task 8), `POINT_VALUE_FCFA` (Task 2).
- Produces: rien en aval.

- [ ] **Step 1: CheckoutView — remises**

État et préview (dans le composant, après `subtotal`) :

```tsx
const [promoCode, setPromoCode] = useState("");
const [pointsReq, setPointsReq] = useState(0);
const [preview, setPreview] = useState<DiscountPreview | null>(null);
const [customerPoints, setCustomerPoints] = useState<number | null>(null);

useEffect(() => {
  const t = setTimeout(async () => {
    const r = await previewWebDiscount({ subtotal, promoCode: promoCode || undefined, pointsRequested: pointsReq });
    if (r.ok) { setPreview(r.preview); setCustomerPoints(r.customerPoints); }
  }, 350);
  return () => clearTimeout(t);
}, [subtotal, promoCode, pointsReq]);
```

(imports : `useEffect`, `previewWebDiscount` depuis `@/lib/discounts/webActions`, `type DiscountPreview` depuis `@/lib/discounts/actions`, `POINT_VALUE_FCFA` depuis `@/lib/customers/loyalty`.) L'appel initial (sans code ni points) sert aussi à connaître `customerPoints` pour décider d'afficher la section points.

Dans la carte récapitulative (avant le séparateur du Total), insérer :

```tsx
<div style={{ marginBottom: 14 }}>
  <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>Code promo (optionnel)</label>
  <input
    value={promoCode}
    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
    placeholder="Ex. TERANGA10"
    style={{ width: "100%", height: 44, padding: "0 13px", border: `1.5px solid ${preview?.promoError ? colors.danger : colors.borderField}`, borderRadius: 10, font: "600 14px ui-monospace,monospace", letterSpacing: ".04em", outline: "none" }}
  />
  {preview?.promoError && <p style={{ font: `500 12.5px ${fonts.ui}`, color: "#9c352d", margin: "7px 0 0" }}>{preview.promoError}</p>}
  {customerPoints !== null && customerPoints > 0 && (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>
        Utiliser mes points — solde {customerPoints} ({money(customerPoints * POINT_VALUE_FCFA)})
      </label>
      <NumericField mode="integer" value={pointsReq} onChange={setPointsReq} min={0} max={customerPoints} placeholder="0" />
    </div>
  )}
</div>
{preview?.promo && (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
    <span>Code {preview.promo.code}</span>
    <span style={{ fontWeight: 600, color: colors.fgSuccess }}>−{money(preview.promo.discount)}</span>
  </div>
)}
{preview && preview.pointsUsed > 0 && (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
    <span>Points ({preview.pointsUsed})</span>
    <span style={{ fontWeight: 600, color: colors.fgSuccess }}>−{money(preview.pointsDiscount)}</span>
  </div>
)}
```

Le « Total estimé » affiche `money(preview ? preview.total : subtotal)`. Le `handleSubmit` passe les remises :

```ts
const response = await submitWebOrder(result.data, lines, {
  promoCode: promoCode.trim() || undefined,
  pointsRequested: pointsReq,
});
```

Corriger au passage la ligne `LoyaltyBadge` (aperçu de points au mauvais taux, `subtotal / 500`) :

```tsx
<LoyaltyBadge points={Math.floor((preview ? preview.total : subtotal) / 1000)} />
```

- [ ] **Step 2: OrdersScreen — lignes de remise + écart**

Dans le panneau détail (autour de la ligne 328, le bloc qui affiche `{o.total}` en grand) : au-dessus du total, insérer :

```tsx
{(o.promoDiscount > 0 || o.pointsUsed > 0) && (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
      <span style={{ color: colors.muted }}>Sous-total</span>
      <span style={{ fontWeight: 600 }}>{o.subtotal}</span>
    </div>
    {o.promoDiscount > 0 && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: colors.muted }}>Code {o.promoCode}</span>
        <span style={{ fontWeight: 600, color: colors.fgSuccess }}>−{money(o.promoDiscount)}</span>
      </div>
    )}
    {o.pointsUsed > 0 && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: colors.muted }}>Points ({o.pointsUsed})</span>
        <span style={{ fontWeight: 600, color: colors.fgSuccess }}>−{money(o.pointsDiscount)}</span>
      </div>
    )}
  </>
)}
{!o.promoStillValid && o.status === "nouvelle" && (
  <div style={{ background: colors.bgWarning, color: colors.fgWarning, borderRadius: 8, padding: "8px 10px", font: `500 12.5px ${fonts.ui}`, marginBottom: 8 }}>
    Le code {o.promoCode} n'est plus valide — valider appliquera le total sans cette remise.
  </div>
)}
```

(import `money` depuis `@/lib/format` si absent ; vérifier les tokens `colors.bgWarning`/`fgWarning` — ils existent dans `lib/theme/tokens` (utilisés par `FinanceScreen`) ; sinon reprendre les couleurs du badge warning existant du fichier.)

- [ ] **Step 3: Vérifier puis committer**

Run: `npm run typecheck && npm run test` → propre.

```bash
git add components/storefront/views/CheckoutView.tsx components/dashboard/screens/OrdersScreen.tsx
git commit -m "feat(storefront): promo and points at checkout, discount rows and stale-promo warning in orders"
```

---

### Task 10: Vérification finale du lot

**Files:**
- Modify: `docs/superpowers/EXECUTION-STATUS.md` (nouvelle section)

**Interfaces:** aucune — clôture.

- [ ] **Step 1: Suite complète**

Run: `npm run test && npm run typecheck && npx next build --webpack`
Expected: tout vert, build OK.

- [ ] **Step 2: Parcours navigateur**

Ce qui est vérifiable sans session owner : checkout web anonyme — saisir un code invalide → message FR sous le champ ; un code valide (en créer un directement en base via MCP si aucun n'existe : `INSERT INTO "PromoCode" ("id","tenantId","code","kind","value") VALUES ('promo-e2e-1','<tenant>','TERANGA10','percent',10);`) → ligne de remise + total réduit ; soumettre → vérifier en base que la commande porte `promoCode/promoDiscount` et que `usedCount` du code est **inchangé** et le solde de points de toute cliente **inchangé** (invariant).

Avec session owner (sinon consigner pour l'utilisateur) : créer un code dans Marketing ; vente POS avec code + points ; valider la commande web → `usedCount` incrémenté, points débités/crédités corrects en base.

- [ ] **Step 3: EXECUTION-STATUS + commit**

Ajouter une section « Lot 3 — codes promo & points dépensables (2026-07-20) » : fait, écarts éventuels, étapes manuelles restantes (mêmes catégories que le lot précédent).

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record promo codes + loyalty redemption completion in EXECUTION-STATUS"
```
