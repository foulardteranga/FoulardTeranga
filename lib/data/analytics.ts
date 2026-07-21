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

export function lastSaleByProduct(
  lines: Array<Pick<SoldLine, "productId" | "soldAt">>
): Map<string, Date> {
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
