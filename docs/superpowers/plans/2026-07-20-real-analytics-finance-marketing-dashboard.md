# Finance, Marketing & Tableau de bord sur données réelles (Lot 4) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lot 4 du spec `docs/superpowers/specs/2026-07-20-payments-promos-ticket-finance-design.md` — les écrans Finance, Marketing (produits stars/dormants + mini-KPI) et Tableau de bord (KPI + graphique) lisent les vraies commandes Postgres au lieu de constantes mockées.

**Architecture:** Un module **pur et testé** `lib/data/analytics.ts` porte toute l'arithmétique (fenêtres de dates, agrégats, séries, classements). Trois fichiers de lecture serveur minces (`finance.server.ts`, `marketing.server.ts`, `dashboard.server.ts`) font les requêtes Prisma, projettent les lignes vers les types du module pur et attachent les libellés. Les trois pages deviennent/restent des Server Components qui passent le résultat en props ; les écrans perdent leurs constantes mockées en conservant leur mise en page.

**Tech Stack:** Next.js 16.2 (Server Components), Prisma 7 + Supabase Postgres (lecture seule — aucune migration dans ce lot), Vitest.

## Global Constraints

- Langue produit : FR. Code/commits : EN. TypeScript strict, jamais de `any`.
- `npm run build` (Turbopack) est cassé (é NFD dans le chemin) — utiliser `npx next build --webpack`. `npm run test` / `npm run typecheck` normaux.
- **Lot strictement lecture seule** : aucune migration, aucune Server Action, aucune écriture Postgres.
- **Chiffre d'affaires** = commandes de statut `confirmee`, `preparation` ou `livree`. Exclues : `nouvelle` (demande non validée) et `refusee`. Cette règle vit dans **une seule** constante (`REVENUE_STATUSES`) réutilisée par les trois lectures.
- **Fuseau boutique** : Abidjan (UTC+0 toute l'année) — les bornes de journée se calculent en UTC, via les helpers du module pur, jamais avec `setHours` local.
- Formatage monétaire **uniquement** via `fmt`/`money` de `lib/format.ts` (jamais de formatage maison).
- Séparation client/serveur : `lib/data/analytics.ts` est pur et importable partout ; les `*.server.ts` importent Prisma et `next/headers` (via `getCurrentTenant`) et ne doivent **jamais** être importés par un Client Component.
- Mise en page des écrans conservée (mêmes cartes, styles, classes) — seule la source des données change.
- Après chaque tâche : `npm run test` et `npm run typecheck` verts.

---

### Task 1: Module d'analytique pur (TDD)

**Files:**
- Create: `lib/data/analytics.ts`
- Create: `lib/data/analytics.test.ts`

**Interfaces:**
- Consumes: rien (module pur, aucune dépendance projet hormis les types).
- Produces (consommés par les Tasks 2, 3, 4) :

```ts
export const REVENUE_STATUSES: readonly ["confirmee", "preparation", "livree"];
export const UNPAID_KEY = "unpaid"; // clé de ventilation des commandes validées non encaissées
export interface RevenueOrder {
  total: number;          // montant réellement payé
  promoDiscount: number;
  pointsDiscount: number;
  lineDiscount: number;   // Σ (remise unitaire × qté) des lignes
  paymentMethod: string | null; // null = commande web pas encore encaissée
  createdAt: Date;
}
export interface PeriodSummary { revenue: number; transactions: number; averageBasket: number; discounts: number }
export function startOfDayUtc(now: Date): Date;
export function addDaysUtc(date: Date, days: number): Date;
export function inWindow(date: Date, start: Date, end: Date): boolean;   // [start, end[
export function summarizePeriod(orders: RevenueOrder[]): PeriodSummary;
export function deltaPct(current: number, previous: number): number | null; // null si previous === 0
export function breakdownByPayment(orders: RevenueOrder[]): Array<{ key: string; amount: number; pct: number }>;
export function dailySeries(orders: RevenueOrder[], now: Date, days: number): Array<{ label: string; value: number }>;
export function weeklySeries(orders: RevenueOrder[], now: Date, weeks: number): Array<{ label: string; value: number }>;
export interface SoldLine { productId: string; qty: number; lineTotal: number; soldAt: Date }
export function topSoldProducts(lines: SoldLine[], limit: number): Array<{ productId: string; qty: number; revenue: number }>;
export function lastSaleByProduct(lines: SoldLine[]): Map<string, Date>;
export function dormantProducts(
  products: Array<{ id: string; stock: number; createdAt: Date }>,
  lastSale: Map<string, Date>,
  now: Date,
  limit: number
): Array<{ productId: string; daysSinceLastSale: number; neverSold: boolean }>;
```

- [ ] **Step 1: Écrire les tests (échec attendu)**

`lib/data/analytics.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  REVENUE_STATUSES,
  startOfDayUtc,
  addDaysUtc,
  inWindow,
  summarizePeriod,
  deltaPct,
  breakdownByPayment,
  dailySeries,
  weeklySeries,
  topSoldProducts,
  lastSaleByProduct,
  dormantProducts,
  type RevenueOrder,
  type SoldLine,
} from "./analytics";

function order(over: Partial<RevenueOrder> = {}): RevenueOrder {
  return {
    total: 10000,
    promoDiscount: 0,
    pointsDiscount: 0,
    lineDiscount: 0,
    paymentMethod: "espece",
    createdAt: new Date("2026-07-20T10:00:00Z"),
    ...over,
  };
}

describe("REVENUE_STATUSES", () => {
  it("compte les commandes validées, jamais les nouvelles ni les refusées", () => {
    expect([...REVENUE_STATUSES]).toEqual(["confirmee", "preparation", "livree"]);
  });
});

describe("bornes de journée (fuseau boutique = UTC)", () => {
  it("ramène à minuit UTC", () => {
    expect(startOfDayUtc(new Date("2026-07-20T23:45:00Z")).toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("décale d'un nombre de jours entier", () => {
    expect(addDaysUtc(new Date("2026-07-20T00:00:00Z"), -1).toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("inclut la borne de début et exclut celle de fin", () => {
    const start = new Date("2026-07-20T00:00:00Z");
    const end = new Date("2026-07-21T00:00:00Z");
    expect(inWindow(start, start, end)).toBe(true);
    expect(inWindow(end, start, end)).toBe(false);
  });
});

describe("summarizePeriod", () => {
  it("agrège CA, transactions, panier moyen et remises", () => {
    const result = summarizePeriod([
      order({ total: 12000, promoDiscount: 1000 }),
      order({ total: 8000, pointsDiscount: 500, lineDiscount: 250 }),
    ]);
    expect(result.revenue).toBe(20000);
    expect(result.transactions).toBe(2);
    expect(result.averageBasket).toBe(10000);
    expect(result.discounts).toBe(1750);
  });

  it("renvoie des zéros sans commande (pas de division par zéro)", () => {
    expect(summarizePeriod([])).toEqual({ revenue: 0, transactions: 0, averageBasket: 0, discounts: 0 });
  });

  it("arrondit le panier moyen au FCFA", () => {
    expect(summarizePeriod([order({ total: 10000 }), order({ total: 10001 })]).averageBasket).toBe(10001);
  });
});

describe("deltaPct", () => {
  it("calcule la variation en pourcentage arrondi", () => {
    expect(deltaPct(120, 100)).toBe(20);
    expect(deltaPct(80, 100)).toBe(-20);
  });

  it("renvoie null quand la période précédente est vide (pas de +Infini%)", () => {
    expect(deltaPct(500, 0)).toBeNull();
  });
});

describe("breakdownByPayment", () => {
  it("regroupe par mode, trie par montant décroissant et calcule les parts", () => {
    const result = breakdownByPayment([
      order({ total: 6000, paymentMethod: "wave" }),
      order({ total: 3000, paymentMethod: "espece" }),
      order({ total: 1000, paymentMethod: "wave" }),
    ]);
    expect(result).toEqual([
      { key: "wave", amount: 7000, pct: 70 },
      { key: "espece", amount: 3000, pct: 30 },
    ]);
  });

  it("regroupe les commandes sans mode sous la clé « unpaid »", () => {
    const result = breakdownByPayment([order({ total: 5000, paymentMethod: null })]);
    expect(result).toEqual([{ key: "unpaid", amount: 5000, pct: 100 }]);
  });

  it("renvoie une liste vide sans commande", () => {
    expect(breakdownByPayment([])).toEqual([]);
  });
});

describe("dailySeries", () => {
  it("produit un point par jour, du plus ancien au plus récent, jours vides à 0", () => {
    const now = new Date("2026-07-20T12:00:00Z"); // lundi
    const series = dailySeries(
      [
        order({ total: 5000, createdAt: new Date("2026-07-20T09:00:00Z") }),
        order({ total: 3000, createdAt: new Date("2026-07-18T09:00:00Z") }),
      ],
      now,
      7
    );
    expect(series).toHaveLength(7);
    expect(series[6].value).toBe(5000);
    expect(series[4].value).toBe(3000);
    expect(series[5].value).toBe(0);
    expect(series[6].label).toBe("Lun");
  });
});

describe("weeklySeries", () => {
  it("produit un point par semaine étiqueté S1..Sn, du plus ancien au plus récent", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const series = weeklySeries(
      [
        order({ total: 4000, createdAt: new Date("2026-07-20T09:00:00Z") }),
        order({ total: 2000, createdAt: new Date("2026-07-01T09:00:00Z") }),
      ],
      now,
      4
    );
    // Fenêtres (now = lundi 20/07) : S1 = [23/06, 30/06[, S2 = [30/06, 07/07[,
    // S3 = [07/07, 14/07[, S4 = [14/07, 21/07[.
    expect(series).toHaveLength(4);
    expect(series.map((s) => s.label)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(series[3].value).toBe(4000); // vente du 20/07
    expect(series[1].value).toBe(2000); // vente du 01/07
    expect(series[0].value).toBe(0);
  });
});

describe("topSoldProducts", () => {
  const lines: SoldLine[] = [
    { productId: "p1", qty: 2, lineTotal: 20000, soldAt: new Date("2026-07-10T00:00:00Z") },
    { productId: "p2", qty: 5, lineTotal: 15000, soldAt: new Date("2026-07-11T00:00:00Z") },
    { productId: "p1", qty: 1, lineTotal: 10000, soldAt: new Date("2026-07-12T00:00:00Z") },
  ];

  it("classe par quantité vendue décroissante et cumule le CA", () => {
    expect(topSoldProducts(lines, 2)).toEqual([
      { productId: "p2", qty: 5, revenue: 15000 },
      { productId: "p1", qty: 3, revenue: 30000 },
    ]);
  });

  it("respecte la limite demandée", () => {
    expect(topSoldProducts(lines, 1)).toHaveLength(1);
  });
});

describe("lastSaleByProduct", () => {
  it("retient la vente la plus récente par produit", () => {
    const map = lastSaleByProduct([
      { productId: "p1", qty: 1, lineTotal: 1, soldAt: new Date("2026-07-10T00:00:00Z") },
      { productId: "p1", qty: 1, lineTotal: 1, soldAt: new Date("2026-07-15T00:00:00Z") },
    ]);
    expect(map.get("p1")?.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
});

describe("dormantProducts", () => {
  const now = new Date("2026-07-20T00:00:00Z");
  const products = [
    { id: "p1", stock: 5, createdAt: new Date("2026-06-01T00:00:00Z") },
    { id: "p2", stock: 3, createdAt: new Date("2026-07-01T00:00:00Z") },
    { id: "p3", stock: 0, createdAt: new Date("2026-05-01T00:00:00Z") },
  ];

  it("ignore les produits sans stock et trie du plus dormant au moins dormant", () => {
    const map = new Map([["p1", new Date("2026-07-18T00:00:00Z")]]);
    const result = dormantProducts(products, map, now, 4);
    expect(result.map((d) => d.productId)).toEqual(["p2", "p1"]);
    expect(result[0]).toEqual({ productId: "p2", daysSinceLastSale: 19, neverSold: true });
    expect(result[1]).toEqual({ productId: "p1", daysSinceLastSale: 2, neverSold: false });
  });

  it("respecte la limite demandée", () => {
    expect(dormantProducts(products, new Map(), now, 1)).toHaveLength(1);
  });
});
```

Run: `npx vitest run lib/data/analytics.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 2: Implémenter `lib/data/analytics.ts`**

```ts
/**
 * Arithmétique d'analytique (finance, marketing, tableau de bord).
 * Module **pur** : aucune I/O, aucune date implicite — `now` est toujours un
 * paramètre, ce qui rend chaque fonction testable et déterministe.
 *
 * Fuseau boutique : Abidjan (UTC+0 toute l'année), donc les bornes de journée
 * se calculent directement en UTC.
 */

/** Statuts comptés comme chiffre d'affaires réel (une demande web non validée n'en est pas un). */
export const REVENUE_STATUSES = ["confirmee", "preparation", "livree"] as const;

export interface RevenueOrder {
  /** Montant réellement payé (net de toutes les remises). */
  total: number;
  promoDiscount: number;
  pointsDiscount: number;
  /** Σ (remise unitaire × qté) des lignes — remise POS « −10% » notamment. */
  lineDiscount: number;
  /** `null` pour une commande web validée mais pas encore encaissée. */
  paymentMethod: string | null;
  createdAt: Date;
}

export interface PeriodSummary {
  revenue: number;
  transactions: number;
  averageBasket: number;
  discounts: number;
}

const DAY_MS = 86_400_000;
const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const;

/** Minuit du jour de `now`, dans le fuseau boutique. */
export function startOfDayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Fenêtre semi-ouverte `[start, end[` — évite de compter deux fois une commande à la frontière. */
export function inWindow(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function summarizePeriod(orders: RevenueOrder[]): PeriodSummary {
  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const discounts = orders.reduce(
    (sum, o) => sum + o.promoDiscount + o.pointsDiscount + o.lineDiscount,
    0
  );
  const transactions = orders.length;
  return {
    revenue,
    transactions,
    averageBasket: transactions === 0 ? 0 : Math.round(revenue / transactions),
    discounts,
  };
}

/** Variation en % entre deux périodes ; `null` quand la précédente est vide (pas de +∞ %). */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Clé utilisée pour les commandes validées mais pas encore encaissées. */
export const UNPAID_KEY = "unpaid";

export function breakdownByPayment(
  orders: RevenueOrder[]
): Array<{ key: string; amount: number; pct: number }> {
  const totals = new Map<string, number>();
  for (const o of orders) {
    const key = o.paymentMethod ?? UNPAID_KEY;
    totals.set(key, (totals.get(key) ?? 0) + o.total);
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  if (grand === 0) return [];
  return [...totals.entries()]
    .map(([key, amount]) => ({ key, amount, pct: Math.round((amount / grand) * 100) }))
    .sort((a, b) => b.amount - a.amount);
}

export function dailySeries(
  orders: RevenueOrder[],
  now: Date,
  days: number
): Array<{ label: string; value: number }> {
  const today = startOfDayUtc(now);
  const series: Array<{ label: string; value: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = addDaysUtc(today, -i);
    const end = addDaysUtc(start, 1);
    const value = orders
      .filter((o) => inWindow(o.createdAt, start, end))
      .reduce((sum, o) => sum + o.total, 0);
    series.push({ label: DAY_LABELS[start.getUTCDay()], value });
  }
  return series;
}

export function weeklySeries(
  orders: RevenueOrder[],
  now: Date,
  weeks: number
): Array<{ label: string; value: number }> {
  const today = startOfDayUtc(now);
  const series: Array<{ label: string; value: number }> = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDaysUtc(today, 1 - i * 7);
    const start = addDaysUtc(end, -7);
    const value = orders
      .filter((o) => inWindow(o.createdAt, start, end))
      .reduce((sum, o) => sum + o.total, 0);
    series.push({ label: `S${weeks - i}`, value });
  }
  return series;
}

export interface SoldLine {
  productId: string;
  qty: number;
  lineTotal: number;
  soldAt: Date;
}

export function topSoldProducts(
  lines: SoldLine[],
  limit: number
): Array<{ productId: string; qty: number; revenue: number }> {
  const totals = new Map<string, { qty: number; revenue: number }>();
  for (const l of lines) {
    const acc = totals.get(l.productId) ?? { qty: 0, revenue: 0 };
    totals.set(l.productId, { qty: acc.qty + l.qty, revenue: acc.revenue + l.lineTotal });
  }
  return [...totals.entries()]
    .map(([productId, v]) => ({ productId, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

export function lastSaleByProduct(lines: SoldLine[]): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const l of lines) {
    const current = map.get(l.productId);
    if (!current || l.soldAt.getTime() > current.getTime()) map.set(l.productId, l.soldAt);
  }
  return map;
}

/**
 * Produits en stock qui dorment : jamais vendus (ancienneté comptée depuis leur
 * création) ou sans vente depuis longtemps, du plus dormant au moins dormant.
 */
export function dormantProducts(
  products: Array<{ id: string; stock: number; createdAt: Date }>,
  lastSale: Map<string, Date>,
  now: Date,
  limit: number
): Array<{ productId: string; daysSinceLastSale: number; neverSold: boolean }> {
  return products
    .filter((p) => p.stock > 0)
    .map((p) => {
      const sale = lastSale.get(p.id);
      const since = sale ?? p.createdAt;
      return {
        productId: p.id,
        daysSinceLastSale: Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS)),
        neverSold: sale === undefined,
      };
    })
    .sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale)
    .slice(0, limit);
}
```

- [ ] **Step 3: Vérifier**

Run: `npx vitest run lib/data/analytics.test.ts`
Expected: PASS (19/19).
Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

- [ ] **Step 4: Commit**

```bash
git add lib/data/analytics.ts lib/data/analytics.test.ts
git commit -m "feat(analytics): pure aggregation module for finance, marketing and dashboard stats"
```

---

### Task 2: Finance — lecture serveur + écran réel

**Files:**
- Create: `lib/data/finance.server.ts`
- Modify: `app/(dashboard)/finance/page.tsx`
- Modify: `components/dashboard/screens/FinanceScreen.tsx`

**Interfaces:**
- Consumes: `REVENUE_STATUSES`, `RevenueOrder`, `summarizePeriod`, `breakdownByPayment`, `startOfDayUtc`, `addDaysUtc`, `inWindow`, `UNPAID_KEY` (Task 1) ; `PAYMENT_LABELS` de `@/lib/payments/labels` ; `formatOrderDate` de `@/lib/data/orderStatus` ; `getCurrentTenant` de `@/lib/tenant` ; `prisma` de `@/lib/db/client`.
- Produces :

```ts
export interface FinanceJournalRow {
  ref: string; date: string; channel: string; paymentLabel: string; total: number;
}
export interface FinanceSnapshot {
  today: { revenue: number; transactions: number; averageBasket: number; discounts: number };
  breakdown: Array<{ key: string; label: string; amount: number; pct: number }>;
  breakdownTotal: number;
  journal: FinanceJournalRow[];
}
export async function getFinanceSnapshot(): Promise<FinanceSnapshot>;
```

- [ ] **Step 1: Créer `lib/data/finance.server.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { PAYMENT_LABELS, type PaymentMethodId } from "@/lib/payments/labels";
import { formatOrderDate } from "./orderStatus";
import {
  REVENUE_STATUSES,
  UNPAID_KEY,
  addDaysUtc,
  breakdownByPayment,
  inWindow,
  startOfDayUtc,
  summarizePeriod,
  type RevenueOrder,
} from "./analytics";

/** Profondeur d'historique des cartes Finance (ventilation + journal). */
const WINDOW_DAYS = 30;
/** Plafond de lignes du journal affiché. */
const JOURNAL_LIMIT = 50;

export interface FinanceJournalRow {
  ref: string;
  date: string;
  channel: string;
  paymentLabel: string;
  total: number;
}

export interface FinanceSnapshot {
  today: { revenue: number; transactions: number; averageBasket: number; discounts: number };
  breakdown: Array<{ key: string; label: string; amount: number; pct: number }>;
  breakdownTotal: number;
  journal: FinanceJournalRow[];
}

function paymentLabel(key: string): string {
  if (key === UNPAID_KEY) return "À encaisser";
  return PAYMENT_LABELS[key as PaymentMethodId] ?? key;
}

/** KPI du jour, ventilation par mode et journal des ventes réelles sur 30 jours. */
export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const tenant = await getCurrentTenant();
  const now = new Date();
  const windowStart = addDaysUtc(startOfDayUtc(now), -(WINDOW_DAYS - 1));

  const rows = await prisma.order.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: [...REVENUE_STATUSES] },
      createdAt: { gte: windowStart },
    },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });

  const orders: RevenueOrder[] = rows.map((r) => ({
    total: r.total,
    promoDiscount: r.promoDiscount,
    pointsDiscount: r.pointsDiscount,
    lineDiscount: r.lines.reduce((sum, l) => sum + l.discount * l.qty, 0),
    paymentMethod: r.paymentMethod,
    createdAt: r.createdAt,
  }));

  const dayStart = startOfDayUtc(now);
  const dayEnd = addDaysUtc(dayStart, 1);
  const today = summarizePeriod(orders.filter((o) => inWindow(o.createdAt, dayStart, dayEnd)));

  const breakdown = breakdownByPayment(orders).map((b) => ({ ...b, label: paymentLabel(b.key) }));
  const breakdownTotal = breakdown.reduce((sum, b) => sum + b.amount, 0);

  const journal: FinanceJournalRow[] = rows.slice(0, JOURNAL_LIMIT).map((r) => ({
    ref: r.ref,
    date: formatOrderDate(r.createdAt, now),
    channel: r.channel,
    paymentLabel: r.paymentMethod ? PAYMENT_LABELS[r.paymentMethod] : "À encaisser",
    total: r.total,
  }));

  return { today, breakdown, breakdownTotal, journal };
}
```

- [ ] **Step 2: Page serveur**

`app/(dashboard)/finance/page.tsx` :

```tsx
import { getFinanceSnapshot } from "@/lib/data/finance.server";
import { FinanceScreen } from "@/components/dashboard/screens/FinanceScreen";

export default async function FinancePage() {
  const snapshot = await getFinanceSnapshot();
  return <FinanceScreen snapshot={snapshot} />;
}
```

- [ ] **Step 3: Brancher `FinanceScreen`**

Dans `components/dashboard/screens/FinanceScreen.tsx` : supprimer les constantes `KPIS`, `TX`, `BREAKDOWN` et la table `MODE_META`. Nouvelle signature et nouvelles données (mise en page **inchangée**) :

```tsx
"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { fmt, money } from "@/lib/format";
import type { FinanceSnapshot } from "@/lib/data/finance.server";

/** Teinte de la barre de ventilation par mode de paiement (repli neutre pour un mode inconnu). */
const MODE_FILL: Record<string, string> = {
  espece: colors.success,
  orange_money: colors.accent,
  wave: colors.primary,
  moov_money: colors.gold,
  mtn_momo: colors.accent,
  mm: colors.primary,
  mixte: colors.gold,
  unpaid: colors.muted,
};

export function FinanceScreen({ snapshot }: { snapshot: FinanceSnapshot }) {
  const kpis = [
    { label: "CA du jour", value: fmt(snapshot.today.revenue), unit: "FCFA" },
    { label: "Transactions", value: String(snapshot.today.transactions), unit: "" },
    { label: "Panier moyen", value: fmt(snapshot.today.averageBasket), unit: "FCFA" },
    { label: "Remises accordées", value: fmt(snapshot.today.discounts), unit: "FCFA" },
  ];
  // …suite dans les étapes ci-dessous
```

Le bloc KPI itère désormais sur `kpis` (même JSX que l'actuel `KPIS.map`).

En-tête du journal : retirer le bouton « Export » (et son `<Icon>`), ne garder que le titre — remplacé par un sous-titre factuel :

```tsx
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Journal des transactions</span>
            <span style={{ fontSize: 12.5, color: colors.muted }}>30 derniers jours</span>
          </div>
```

Corps du journal (remplace `TX.map`) :

```tsx
                {snapshot.journal.map((t, i) => (
                  <tr key={t.ref} style={{ borderTop: "1px solid #EFEAE0", background: i % 2 ? colors.rowAlt : "#fff" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>{t.ref}</td>
                    <td style={{ padding: 10, color: colors.muted }}>{t.date}</td>
                    <td style={{ padding: 10, color: colors.muted }}>{t.channel}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 11.5px ${fonts.ui}`, padding: "3px 8px", borderRadius: 999, background: colors.bgInfo, color: colors.primary }}>
                        {t.paymentLabel}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: colors.ink }}>{money(t.total)}</td>
                  </tr>
                ))}
```

Et, juste après la `</table>`, un état vide :

```tsx
            {snapshot.journal.length === 0 && (
              <p style={{ padding: "18px 16px", fontSize: 13, color: colors.muted, margin: 0 }}>
                Aucune vente sur les 30 derniers jours.
              </p>
            )}
```

Carte « Encaissements par mode » (remplace `BREAKDOWN.map` et le total en dur) :

```tsx
          <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 16 }}>Encaissements par mode</div>
          {snapshot.breakdown.length === 0 && (
            <p style={{ fontSize: 13, color: colors.muted, margin: "0 0 16px" }}>Aucun encaissement sur la période.</p>
          )}
          {snapshot.breakdown.map((p) => (
            <div key={p.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{money(p.amount)}</span>
              </div>
              <div style={{ height: 9, background: "#F1ECE2", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p.pct}%`, background: MODE_FILL[p.key] ?? colors.primary, borderRadius: 999 }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${colors.borderSoft}`, marginTop: 6, paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total encaissé</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22, color: colors.primary }}>{money(snapshot.breakdownTotal)}</span>
            </div>
          </div>
```

Retirer les imports devenus inutiles (`Icon`/`ICONS` si plus aucun usage). Vérifier que `colors.gold` existe dans `lib/theme/tokens.ts` (il est utilisé par `MarketingScreen`) ; sinon reprendre une teinte existante du fichier.

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

- [ ] **Step 5: Commit**

```bash
git add lib/data/finance.server.ts "app/(dashboard)/finance/page.tsx" components/dashboard/screens/FinanceScreen.tsx
git commit -m "feat(finance): real KPIs, payment breakdown and sales journal from Postgres"
```

---

### Task 3: Marketing — produits stars, dormants et mini-KPI réels

**Files:**
- Create: `lib/data/marketing.server.ts`
- Modify: `app/(dashboard)/marketing/page.tsx`
- Modify: `components/dashboard/screens/MarketingScreen.tsx`

**Interfaces:**
- Consumes: `REVENUE_STATUSES`, `SoldLine`, `topSoldProducts`, `lastSaleByProduct`, `dormantProducts`, `startOfDayUtc`, `addDaysUtc` (Task 1) ; `getCatalog` de `@/lib/data/catalog.server` reste utilisé par la page pour le reste de l'écran.
- Produces :

```ts
export interface MarketingProductStat {
  id: string; name: string; image: string | null; swatch: string;
  qty: number; revenue: number;                 // stars
}
export interface MarketingDormantStat {
  id: string; name: string; image: string | null; swatch: string;
  stock: number; days: number; neverSold: boolean;
}
export interface MarketingStats {
  stars: MarketingProductStat[];
  dormant: MarketingDormantStat[];
  activeCustomers: number;   // clientes avec ≥ 1 commande comptée sur 30 j
  totalCustomers: number;
  repeatRate: number;        // % de clientes ayant ≥ 2 commandes (arrondi)
}
export async function getMarketingStats(): Promise<MarketingStats>;
```

- [ ] **Step 1: Créer `lib/data/marketing.server.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import {
  REVENUE_STATUSES,
  addDaysUtc,
  dormantProducts,
  lastSaleByProduct,
  startOfDayUtc,
  topSoldProducts,
  type SoldLine,
} from "./analytics";

/** Fenêtre d'analyse des ventes (produits stars, clientes actives). */
const WINDOW_DAYS = 30;
/** Nombre de produits affichés dans chaque carte. */
const CARD_SIZE = 4;

export interface MarketingProductStat {
  id: string;
  name: string;
  image: string | null;
  swatch: string;
  qty: number;
  revenue: number;
}

export interface MarketingDormantStat {
  id: string;
  name: string;
  image: string | null;
  swatch: string;
  stock: number;
  days: number;
  neverSold: boolean;
}

export interface MarketingStats {
  stars: MarketingProductStat[];
  dormant: MarketingDormantStat[];
  activeCustomers: number;
  totalCustomers: number;
  repeatRate: number;
}

/** Statistiques produits/clientes de l'écran Marketing, sur 30 jours glissants. */
export async function getMarketingStats(): Promise<MarketingStats> {
  const tenant = await getCurrentTenant();
  const now = new Date();
  const windowStart = addDaysUtc(startOfDayUtc(now), -(WINDOW_DAYS - 1));

  const [products, soldRows, customers, activeCustomerGroups] = await Promise.all([
    prisma.product.findMany({ where: { tenantId: tenant.id } }),
    prisma.orderLine.findMany({
      where: {
        order: {
          tenantId: tenant.id,
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: windowStart },
        },
      },
      select: { productId: true, qty: true, lineTotal: true, order: { select: { createdAt: true } } },
    }),
    prisma.customer.findMany({ where: { tenantId: tenant.id }, select: { ordersCount: true } }),
    prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: [...REVENUE_STATUSES] },
        createdAt: { gte: windowStart },
        customerId: { not: null },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
  ]);

  const lines: SoldLine[] = soldRows.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    lineTotal: l.lineTotal,
    soldAt: l.order.createdAt,
  }));
  const byId = new Map(products.map((p) => [p.id, p]));

  const stars: MarketingProductStat[] = topSoldProducts(lines, CARD_SIZE).flatMap((s) => {
    const p = byId.get(s.productId);
    if (!p) return [];
    return [{ id: p.id, name: p.name, image: p.image, swatch: p.swatch, qty: s.qty, revenue: s.revenue }];
  });

  const dormant: MarketingDormantStat[] = dormantProducts(
    products.map((p) => ({ id: p.id, stock: p.stock, createdAt: p.createdAt })),
    lastSaleByProduct(lines),
    now,
    CARD_SIZE
  ).flatMap((d) => {
    const p = byId.get(d.productId);
    if (!p) return [];
    return [
      {
        id: p.id,
        name: p.name,
        image: p.image,
        swatch: p.swatch,
        stock: p.stock,
        days: d.daysSinceLastSale,
        neverSold: d.neverSold,
      },
    ];
  });

  const totalCustomers = customers.length;
  const repeatCustomers = customers.filter((c) => c.ordersCount >= 2).length;

  return {
    stars,
    dormant,
    activeCustomers: activeCustomerGroups.length,
    totalCustomers,
    repeatRate: totalCustomers === 0 ? 0 : Math.round((repeatCustomers / totalCustomers) * 100),
  };
}
```

- [ ] **Step 2: Page serveur**

`app/(dashboard)/marketing/page.tsx` :

```tsx
import { getPromoCodes } from "@/lib/data/promos.server";
import { getMarketingStats } from "@/lib/data/marketing.server";
import { MarketingScreen } from "@/components/dashboard/screens/MarketingScreen";

export default async function MarketingPage() {
  const [promos, stats] = await Promise.all([getPromoCodes(), getMarketingStats()]);
  return <MarketingScreen promos={promos} stats={stats} />;
}
```

(La prop `products` disparaît : elle ne servait qu'à indexer les mocks `STARS`/`DORMANT`. Retirer aussi l'import `getCatalog` s'il n'a plus d'usage dans ce fichier.)

- [ ] **Step 3: Brancher `MarketingScreen`**

Dans `components/dashboard/screens/MarketingScreen.tsx` : supprimer les constantes locales `STARS` et `DORMANT`, retirer la prop `products` et l'import du type `Product`, ajouter `import type { MarketingStats } from "@/lib/data/marketing.server";`. Nouvelle signature :

```tsx
export function MarketingScreen({ promos, stats }: { promos: PromoCodeView[]; stats: MarketingStats }) {
```

Carte « Produits stars » (remplace `STARS.map`) — vignette image avec repli dégradé, comme ailleurs dans le back-office :

```tsx
          {stats.stars.length === 0 && (
            <p style={{ padding: "12px 18px", fontSize: 13, color: colors.muted, margin: 0 }}>
              Aucune vente sur les 30 derniers jours.
            </p>
          )}
          {stats.stars.map((p) => (
            <div key={p.id} style={row}>
              <ProductThumb image={p.image} swatch={p.swatch} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>{p.qty} vendus · 30 j</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: colors.fgSuccess }}>{money(p.revenue)}</span>
            </div>
          ))}
```

Carte « Produits dormants » (remplace `DORMANT.map`) :

```tsx
          {stats.dormant.length === 0 && (
            <p style={{ padding: "12px 18px", fontSize: 13, color: colors.muted, margin: 0 }}>
              Aucun produit en stock sans vente.
            </p>
          )}
          {stats.dormant.map((p) => (
            <div key={p.id} style={row}>
              <ProductThumb image={p.image} swatch={p.swatch} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>
                  {p.neverSold ? `Jamais vendu · ${p.days} j en catalogue` : `${p.days} j sans vente`}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: colors.fgDanger }}>{p.stock} en stock</span>
            </div>
          ))}
```

Mini-KPI (remplacent les deux valeurs en dur) — les sous-textes deviennent factuels, plus de deltas inventés :

```tsx
            <MiniKpi
              label="Taux de rachat"
              value={`${stats.repeatRate}%`}
              delta={`${stats.totalCustomers} cliente${stats.totalCustomers > 1 ? "s" : ""} au total`}
              color={colors.primary}
            />
            <MiniKpi
              label="Clientes actives"
              value={String(stats.activeCustomers)}
              delta="sur 30 jours"
            />
```

Ajouter en bas de fichier le composant de vignette (le helper `swatch(bg)` existant reste utilisé comme repli) :

```tsx
function ProductThumb({ image, swatch: bg }: { image: string | null; swatch: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" style={{ width: 34, height: 34, borderRadius: 8, flex: "none", objectFit: "cover" }} />;
  }
  return <span style={swatch(bg)} />;
}
```

Adapter la couleur `colors.fgDanger` si le token n'existe pas (vérifier `lib/theme/tokens.ts` — il est déjà utilisé dans ce fichier pour le stock).

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

- [ ] **Step 5: Commit**

```bash
git add lib/data/marketing.server.ts "app/(dashboard)/marketing/page.tsx" components/dashboard/screens/MarketingScreen.tsx
git commit -m "feat(marketing): real top/dormant products and customer KPIs from Postgres"
```

---

### Task 4: Tableau de bord — KPI et graphique réels

**Files:**
- Create: `lib/data/dashboard.server.ts`
- Modify: `app/(dashboard)/tableau-de-bord/page.tsx`
- Modify: `components/dashboard/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `REVENUE_STATUSES`, `RevenueOrder`, `summarizePeriod`, `deltaPct`, `dailySeries`, `weeklySeries`, `startOfDayUtc`, `addDaysUtc`, `inWindow` (Task 1).
- Produces :

```ts
export interface DashboardStats {
  today: { revenue: number; transactions: number; averageBasket: number };
  deltas: { revenue: number | null; transactions: number | null; averageBasket: number | null };
  series7: Array<{ label: string; value: number }>;
  series30: Array<{ label: string; value: number }>;
}
export async function getDashboardStats(): Promise<DashboardStats>;
```

- [ ] **Step 1: Créer `lib/data/dashboard.server.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import {
  REVENUE_STATUSES,
  addDaysUtc,
  dailySeries,
  deltaPct,
  inWindow,
  startOfDayUtc,
  summarizePeriod,
  weeklySeries,
  type RevenueOrder,
} from "./analytics";

/** Profondeur nécessaire au graphique 30 jours (4 semaines glissantes). */
const WINDOW_DAYS = 28;

export interface DashboardStats {
  today: { revenue: number; transactions: number; averageBasket: number };
  deltas: { revenue: number | null; transactions: number | null; averageBasket: number | null };
  series7: Array<{ label: string; value: number }>;
  series30: Array<{ label: string; value: number }>;
}

/** KPI du jour (avec variation vs hier) et séries du graphique de tendance. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const tenant = await getCurrentTenant();
  const now = new Date();
  const windowStart = addDaysUtc(startOfDayUtc(now), -(WINDOW_DAYS - 1));

  const rows = await prisma.order.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: [...REVENUE_STATUSES] },
      createdAt: { gte: windowStart },
    },
    select: { total: true, promoDiscount: true, pointsDiscount: true, paymentMethod: true, createdAt: true },
  });

  const orders: RevenueOrder[] = rows.map((r) => ({
    total: r.total,
    promoDiscount: r.promoDiscount,
    pointsDiscount: r.pointsDiscount,
    lineDiscount: 0, // non utilisé par le tableau de bord (aucun KPI de remise ici)
    paymentMethod: r.paymentMethod,
    createdAt: r.createdAt,
  }));

  const dayStart = startOfDayUtc(now);
  const dayEnd = addDaysUtc(dayStart, 1);
  const prevStart = addDaysUtc(dayStart, -1);

  const today = summarizePeriod(orders.filter((o) => inWindow(o.createdAt, dayStart, dayEnd)));
  const yesterday = summarizePeriod(orders.filter((o) => inWindow(o.createdAt, prevStart, dayStart)));

  return {
    today: { revenue: today.revenue, transactions: today.transactions, averageBasket: today.averageBasket },
    deltas: {
      revenue: deltaPct(today.revenue, yesterday.revenue),
      transactions: deltaPct(today.transactions, yesterday.transactions),
      averageBasket: deltaPct(today.averageBasket, yesterday.averageBasket),
    },
    series7: dailySeries(orders, now, 7),
    series30: weeklySeries(orders, now, 4),
  };
}
```

- [ ] **Step 2: Page serveur**

Lire d'abord `app/(dashboard)/tableau-de-bord/page.tsx` : elle fetche déjà `getCatalog()` et `getOrders()`. Ajouter le troisième fetch **en parallèle** et passer la prop :

```tsx
const [products, orders, stats] = await Promise.all([getCatalog(), getOrders(), getDashboardStats()]);
return <DashboardScreen products={products} orders={orders} stats={stats} />;
```

avec `import { getDashboardStats } from "@/lib/data/dashboard.server";` (conserver la structure exacte du fichier existant pour le reste).

- [ ] **Step 3: Brancher `DashboardScreen`**

Dans `components/dashboard/screens/DashboardScreen.tsx` : supprimer les constantes `KPIS`, `T7` et `T30`. Signature :

```tsx
import type { DashboardStats } from "@/lib/data/dashboard.server";
import { fmt } from "@/lib/format";

export function DashboardScreen({ products, orders, stats }: { products: Product[]; orders: Order[]; stats: DashboardStats }) {
```

KPI dérivés (juste avant le `useMemo` existant) — un delta absent (`null`, hier sans vente) s'affiche « nouveau » plutôt qu'un faux pourcentage :

```tsx
  const kpis = useMemo(() => {
    const describe = (delta: number | null) => ({
      up: (delta ?? 0) >= 0,
      delta: delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`,
      sub: delta === null ? "pas de vente hier" : "vs hier",
    });
    return [
      { label: "CA du jour", value: fmt(stats.today.revenue), unit: "FCFA", icon: ICONS.trendUp, ...describe(stats.deltas.revenue) },
      { label: "Ventes", value: String(stats.today.transactions), unit: "", icon: ICONS.orders, ...describe(stats.deltas.transactions) },
      { label: "Panier moyen", value: fmt(stats.today.averageBasket), unit: "FCFA", icon: ICONS.cart, ...describe(stats.deltas.averageBasket) },
    ];
  }, [stats]);
```

Le bloc KPI itère désormais sur `kpis` (`{kpis.map((k) => (`) — JSX inchangé par ailleurs.

Graphique (remplace le `useMemo` `trend`) — la barre mise en avant devient celle du **maximum réel**, plus un index en dur, et un `max` à 0 ne divise plus par zéro :

```tsx
  const trend = useMemo(() => {
    const raw = range === "7" ? stats.series7 : stats.series30;
    const max = Math.max(0, ...raw.map((r) => r.value));
    const peak = raw.findIndex((r) => r.value === max && max > 0);
    return raw.map((r, i) => ({
      label: r.label,
      h: max === 0 ? "0%" : Math.round((r.value / max) * 100) + "%",
      fill: i === peak ? colors.accent : colors.primary,
    }));
  }, [range, stats]);
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

- [ ] **Step 5: Commit**

```bash
git add lib/data/dashboard.server.ts "app/(dashboard)/tableau-de-bord/page.tsx" components/dashboard/screens/DashboardScreen.tsx
git commit -m "feat(dashboard): real daily KPIs with deltas and sales trend chart"
```

---

### Task 5: Vérification finale du lot

**Files:**
- Modify: `docs/superpowers/EXECUTION-STATUS.md`

**Interfaces:** aucune — clôture.

- [ ] **Step 1: Chasse aux mocks résiduels**

Run: `grep -rnE "^const [A-Z_]+ (=|:)" components/dashboard/screens/*.tsx`
Expected: plus aucune constante de **données** (seuls doivent rester des constantes de style/config : `PAGE_SIZE`, `SWATCH_PALETTE`, `EMPTY_PRODUCT_FORM`, `SEGMENTS`, `PRIMARY_PALETTE`, `ACCENT_PALETTE`, `FONT_OPTIONS`, `MODE_FILL`). **`HISTORY` dans `InventoryScreen.tsx` reste** : l'historique de mouvements de stock exige une table dédiée (chantier séparé) — le noter dans EXECUTION-STATUS, ne pas l'inventer ici.

- [ ] **Step 2: Suite complète**

Run: `npm run test && npm run typecheck && npx next build --webpack`
Expected: tout vert, build réussi.

- [ ] **Step 3: Cohérence des chiffres en base**

Comparer l'affichage aux données réelles via le MCP Supabase :

```sql
SELECT status, count(*), sum(total) FROM "Order" WHERE "tenantId" = 'foulard-teranga' GROUP BY status;
SELECT "paymentMethod", count(*), sum(total) FROM "Order"
 WHERE "tenantId" = 'foulard-teranga' AND status IN ('confirmee','preparation','livree')
   AND "createdAt" >= now() - interval '30 days' GROUP BY "paymentMethod";
```

Vérifier que le total de la ventilation Finance égale la somme des commandes comptées, et qu'aucune commande `nouvelle`/`refusee` n'y figure.

- [ ] **Step 4: Parcours navigateur**

Serveur : `preview_start` sur la config `dev`. Les écrans concernés sont derrière l'auth gérante ; si aucune session n'est disponible, consigner les étapes pour l'utilisateur (comme aux lots précédents) après avoir vérifié que la vitrine publique et le build ne régressent pas.

- [ ] **Step 5: EXECUTION-STATUS + commit**

Ajouter une section « Lot 4 — Finance, Marketing & Tableau de bord réels (2026-07-20) » : ce qui est branché, les règles retenues (statuts comptés, fenêtre 30 j, fuseau UTC), ce qui reste mocké et pourquoi (`HISTORY` de l'inventaire → chantier « journal des mouvements de stock »), et les vérifications restant à l'utilisateur.

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record real finance/marketing/dashboard analytics in EXECUTION-STATUS"
```
