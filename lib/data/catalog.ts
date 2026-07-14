import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { Product as PrismaProduct } from "@/lib/generated/prisma/client";
import type { Product, ProductCategory } from "./types";

export const categories: Array<"Tous" | ProductCategory> = [
  "Tous",
  "Foulards",
  "Turbans",
  "Tissus",
  "Accessoires",
];

/** Catégories mises en avant sur la Home (les Tissus restent filtrables au catalogue mais hors vignettes). */
export const storefrontCategories: ProductCategory[] = ["Foulards", "Turbans", "Accessoires"];

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
  };
}

/** Lit tout le catalogue du tenant courant depuis Postgres. */
export async function getCatalog(): Promise<Product[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.product.findMany({
    where: { tenantId: tenant.id },
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

/** Produits mis en avant sur la Home : les articles badgés d'abord, puis le reste, dans l'ordre du catalogue. */
export function newestProducts(products: Product[], limit = 4): Product[] {
  const badged = products.filter((p) => p.badge);
  const rest = products.filter((p) => !p.badge);
  return [...badged, ...rest].slice(0, limit);
}

/** Le produit vedette de la Home (le premier marqué `featured`, sinon le premier du catalogue). */
export function featuredProduct(products: Product[]): Product | undefined {
  return products.find((p) => p.featured) ?? products[0];
}

/** Produits de la même catégorie, hors le produit lui-même. */
export function relatedTo(products: Product[], productId: string, limit = 4): Product[] {
  const current = products.find((p) => p.id === productId);
  if (!current) return [];
  return products.filter((p) => p.cat === current.cat && p.id !== current.id).slice(0, limit);
}

export interface CatalogFilters {
  cat: "Tous" | ProductCategory;
  color: string;
  motif: string;
  priceMax: number;
  query: string;
  sort: "new" | "asc" | "desc";
}

/** Filtrage + tri du catalogue pour l'écran Catalogue de la vitrine. */
export function filterCatalog(products: Product[], filters: CatalogFilters): Product[] {
  let list = products.filter((p) => filters.cat === "Tous" || p.cat === filters.cat);
  if (filters.color) list = list.filter((p) => p.colors.includes(filters.color));
  if (filters.motif) list = list.filter((p) => p.motif === filters.motif);
  list = list.filter((p) => p.price <= filters.priceMax);
  const q = filters.query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.motif.toLowerCase().includes(q)
    );
  }
  if (filters.sort === "asc") list = [...list].sort((a, b) => a.price - b.price);
  if (filters.sort === "desc") list = [...list].sort((a, b) => b.price - a.price);
  return list;
}
