import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { Product as PrismaProduct } from "@/lib/generated/prisma/client";
import type { Product } from "./types";

/** Convertit une ligne Prisma (colonne `category`) vers le type applicatif `Product` (champ `cat`). */
export function toProduct(row: PrismaProduct): Product {
  return {
    id: row.id,
    cat: row.category,
    name: row.name,
    variant: row.variant,
    price: row.price,
    stock: row.stock,
    swatch: row.swatch,
    colors: row.colors,
    motif: row.motif,
    lengths: row.lengths,
    description: row.description,
    oldPrice: row.oldPrice ?? undefined,
    badge: row.badge ?? undefined,
    featured: row.featured,
    image: row.image ?? undefined,
    gallery: row.gallery,
  };
}

/**
 * Lit tout le catalogue depuis Postgres. `tenantId` explicite pour les appelants
 * hors requête HTTP (ex. `generateStaticParams`, exécuté au build — `headers()`
 * n'y est pas disponible) ; sinon résolu depuis la requête courante via `proxy.ts`.
 */
export async function getCatalog(tenantId?: string): Promise<Product[]> {
  const id = tenantId ?? (await getCurrentTenant()).id;
  const rows = await prisma.product.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toProduct);
}

/** Lit un seul produit par id, scopé au tenant courant. `null` si absent. */
export async function getProductById(id: string): Promise<Product | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
  });
  return row ? toProduct(row) : null;
}
