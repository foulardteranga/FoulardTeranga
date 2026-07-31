"use server";

import { prisma } from "@/lib/db/client";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";

/**
 * Export JSON complet d'une boutique (spec §10) — filet de sécurité avant une
 * suppression définitive. Chaque collection est filtrée par `tenantId` : ce
 * module n'est pas concerné par la claim « sans filtre » de `queries.ts`.
 *
 * Server Action plutôt que Route Handler : `/api/...` n'appartient ni à
 * ADMIN_PATHS ni à DASHBOARD_PATHS (lib/proxy/zones.ts), donc un handler ne
 * serait joignable qu'en zone storefront — une surface publique. La garde reste
 * ici, au même endroit que celle de toutes les autres actions plateforme.
 */
export async function exportTenantData(tenantId: string): Promise<ExportResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { ok: false, error: "Boutique introuvable." };

    const [products, customers, orders, storefrontPages, promoCodes, stockMovements] = await Promise.all([
      prisma.product.findMany({ where: { tenantId } }),
      prisma.customer.findMany({ where: { tenantId } }),
      prisma.order.findMany({ where: { tenantId }, include: { lines: true } }),
      prisma.storefrontPage.findMany({ where: { tenantId } }),
      prisma.promoCode.findMany({ where: { tenantId } }),
      prisma.stockMovement.findMany({ where: { tenantId } }),
    ]);

    const exportedAt = new Date();
    const payload = {
      exportedAt: exportedAt.toISOString(),
      tenant,
      products,
      customers,
      orders,
      storefrontPages,
      promoCodes,
      stockMovements,
    };

    await recordPlatformAction({
      actorId: actor.userId,
      action: "data_exported",
      tenantId,
      metadata: {
        slug: tenant.slug,
        name: tenant.name,
        counts: {
          products: products.length,
          customers: customers.length,
          orders: orders.length,
          storefrontPages: storefrontPages.length,
          promoCodes: promoCodes.length,
          stockMovements: stockMovements.length,
        },
      },
    });

    const day = exportedAt.toISOString().slice(0, 10);
    return {
      ok: true,
      filename: `${tenant.slug}-${day}.json`,
      // `JSON.stringify` sérialise les Date en ISO 8601 et les Decimal Prisma en
      // nombre : aucune perte pour les types réellement présents dans ce schéma
      // (Int, String, String[], Json, DateTime, Boolean).
      json: JSON.stringify(payload, null, 2),
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
