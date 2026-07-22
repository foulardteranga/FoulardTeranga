import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import {
  REVENUE_STATUSES,
  addDaysUtc,
  dailySeries,
  deltaPct,
  inWindow,
  splitByChannel,
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
  channelSplit: { inStore: number; online: number };
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
    select: {
      total: true,
      promoDiscount: true,
      pointsDiscount: true,
      paymentMethod: true,
      createdAt: true,
      channel: true,
    },
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
  const todayRows = rows.filter((r) => inWindow(r.createdAt, dayStart, dayEnd));

  return {
    today: { revenue: today.revenue, transactions: today.transactions, averageBasket: today.averageBasket },
    deltas: {
      revenue: deltaPct(today.revenue, yesterday.revenue),
      transactions: deltaPct(today.transactions, yesterday.transactions),
      averageBasket: deltaPct(today.averageBasket, yesterday.averageBasket),
    },
    series7: dailySeries(orders, now, 7),
    series30: weeklySeries(orders, now, 4),
    channelSplit: splitByChannel(todayRows),
  };
}
