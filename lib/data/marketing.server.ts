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

  const [products, windowSoldRows, allSoldRows, customers, activeCustomerGroups] = await Promise.all([
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
    // Sans borne de date : sert uniquement à dater la dernière vente de chaque
    // produit. Si on la limitait à `windowStart`, un produit vendu il y a plus
    // de 30 jours n'aurait aucune entrée et passerait à tort pour « jamais
    // vendu » dans la carte « Produits dormants ».
    prisma.orderLine.findMany({
      where: { order: { tenantId: tenant.id, status: { in: [...REVENUE_STATUSES] } } },
      select: { productId: true, order: { select: { createdAt: true } } },
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

  const windowLines: SoldLine[] = windowSoldRows.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    lineTotal: l.lineTotal,
    soldAt: l.order.createdAt,
  }));
  const byId = new Map(products.map((p) => [p.id, p]));

  const stars: MarketingProductStat[] = topSoldProducts(windowLines, CARD_SIZE).flatMap((s) => {
    const p = byId.get(s.productId);
    if (!p) return [];
    return [{ id: p.id, name: p.name, image: p.image, swatch: p.swatch, qty: s.qty, revenue: s.revenue }];
  });

  const dormant: MarketingDormantStat[] = dormantProducts(
    products.map((p) => ({ id: p.id, stock: p.stock, createdAt: p.createdAt })),
    lastSaleByProduct(allSoldRows.map((l) => ({ productId: l.productId, soldAt: l.order.createdAt }))),
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
