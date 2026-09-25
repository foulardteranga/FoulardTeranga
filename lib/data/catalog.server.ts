import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { Product as PrismaProduct, ProductVariant as PrismaProductVariant } from "@/lib/generated/prisma/client";
import type { Product } from "./types";

type PrismaProductWithVariants = PrismaProduct & {
  variants?: PrismaProductVariant[];
};

/** Convertit une ligne Prisma (colonne `category`) vers le type applicatif `Product` (champ `cat`). */
export function toProduct(row: PrismaProductWithVariants): Product {
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
    active: row.active ?? true,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    variants: row.variants
      ? row.variants.map((v) => ({
          id: v.id,
          productId: v.productId,
          colorName: v.colorName,
          colorHex: v.colorHex,
          stock: v.stock,
          sku: v.sku,
          image: v.image,
          active: v.active,
          position: v.position,
        }))
      : undefined,
  };
}

/**
 * Lit le catalogue depuis Postgres.
 * Par défaut, filtre sur les produits actifs (active: true).
 * Passer `{ includeArchived: true }` pour l'inventaire back-office.
 */
export async function getCatalog(
  tenantId?: string,
  options?: { includeArchived?: boolean }
): Promise<Product[]> {
  const id = tenantId ?? (await getCurrentTenant()).id;
  const where: { tenantId: string; active?: boolean } = { tenantId: id };
  if (!options?.includeArchived) {
    where.active = true;
  }
  const rows = await prisma.product.findMany({
    where,
    include: { variants: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toProduct);
}

/** Lit un seul produit par id, scopé au tenant courant. `null` si absent ou archivé (sauf si includeArchived: true). */
export async function getProductById(
  id: string,
  options?: { includeArchived?: boolean; tenantId?: string }
): Promise<Product | null> {
  const tenantId = options?.tenantId ?? (await getCurrentTenant()).id;
  const where: { id: string; tenantId: string; active?: boolean } = { id, tenantId };
  if (!options?.includeArchived) {
    where.active = true;
  }
  const row = await prisma.product.findFirst({
    where,
    include: { variants: { orderBy: { position: "asc" } } },
  });
  return row ? toProduct(row) : null;
}

