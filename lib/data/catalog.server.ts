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
 * Lit tout le catalogue depuis Postgres. `tenantId` explicite pour les appelants
 * hors requête HTTP (ex. `generateStaticParams`, exécuté au build — `headers()`
 * n'y est pas disponible) ; sinon résolu depuis la requête courante via `proxy.ts`.
 */
export async function getCatalog(tenantId?: string): Promise<Product[]> {
  const id = tenantId ?? (await getCurrentTenant()).id;
  const rows = await prisma.product.findMany({
    where: { tenantId: id },
    include: { variants: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toProduct);
}

/** Lit un seul produit par id, scopé au tenant courant. `null` si absent. */
export async function getProductById(id: string): Promise<Product | null> {
  const tenant = await getCurrentTenant();
  const row = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    include: { variants: { orderBy: { position: "asc" } } },
  });
  return row ? toProduct(row) : null;
}
