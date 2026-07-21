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
