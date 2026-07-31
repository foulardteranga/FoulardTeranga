import { prisma } from "@/lib/db/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "./guard";

export interface TenantHealth {
  productCount: number;
  outOfStockCount: number;
  ordersLast30Days: number;
  storefrontPublished: boolean;
  ownerLastSignInAt: Date | null;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Indicateurs de dépannage d'une boutique (spec §10). Toutes les requêtes sont
 * filtrées par `tenantId` — contrairement à `queries.ts`, ce module n'a aucune
 * raison de lire sans filtre.
 *
 * `ownerLastSignInAt` vient de Supabase Auth, pas de Postgres : `Profile` ne
 * stocke pas la dernière connexion. Toute erreur Auth dégrade en `null` plutôt
 * que de lever — un diagnostic partiel vaut mieux qu'une fiche boutique
 * inaccessible.
 */
export async function getTenantHealth(
  tenantId: string,
  ownerProfileId: string | null
): Promise<TenantHealth> {
  await requireSuperAdmin();

  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [productCount, outOfStockCount, ordersLast30Days, publishedPage] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, stock: { lte: 0 } } }),
    prisma.order.count({ where: { tenantId, createdAt: { gte: since } } }),
    prisma.storefrontPage.findFirst({
      where: { tenantId, publishedAt: { not: null } },
      select: { publishedAt: true },
    }),
  ]);

  let ownerLastSignInAt: Date | null = null;
  if (ownerProfileId) {
    try {
      const { data, error } = await createAdminClient().auth.admin.getUserById(ownerProfileId);
      const raw = error ? null : (data.user?.last_sign_in_at ?? null);
      ownerLastSignInAt = raw ? new Date(raw) : null;
    } catch {
      ownerLastSignInAt = null;
    }
  }

  return {
    productCount,
    outOfStockCount,
    ordersLast30Days,
    storefrontPublished: publishedPage !== null,
    ownerLastSignInAt,
  };
}
