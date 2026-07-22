import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { formatOrderDate } from "./orderStatus";
import { STOCK_MOVEMENT_REASON_LABELS } from "./stockMovementLabels";

/** Nombre de mouvements affichés par défaut dans le tiroir produit. */
const DEFAULT_LIMIT = 5;

export interface StockMovementView {
  id: string;
  date: string;
  reasonLabel: string;
  delta: number;
  authorName: string;
}

/** Les `limit` derniers mouvements d'un produit du tenant courant, plus récents d'abord. */
export async function getRecentStockMovements(
  productId: string,
  limit: number = DEFAULT_LIMIT
): Promise<StockMovementView[]> {
  const tenant = await getCurrentTenant();
  const now = new Date();
  const rows = await prisma.stockMovement.findMany({
    where: { productId, tenantId: tenant.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    date: formatOrderDate(r.createdAt, now),
    reasonLabel: STOCK_MOVEMENT_REASON_LABELS[r.reason],
    delta: r.delta,
    authorName: r.author.name,
  }));
}
