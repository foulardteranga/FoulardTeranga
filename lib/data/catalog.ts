import type { Product, ProductCategory } from "./types";

export const categories: Array<"Tous" | ProductCategory> = [
  "Tous",
  "Foulards",
  "Turbans",
  "Coiffes",
  "Eventails",
  "Voiles",
];

/** Catégories mises en avant sur la Home (vignettes "shop by category"). */
export const storefrontCategories: ProductCategory[] = ["Foulards", "Turbans", "Coiffes", "Eventails", "Voiles"];

/** Libellé affiché pour chaque catégorie (certaines valeurs stockées en base sont des identifiants sans accent/parenthèses). */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  Foulards: "Foulards",
  Turbans: "Turbans",
  Coiffes: "Coiffes (bibi)",
  Eventails: "Éventails",
  Voiles: "Voiles",
};

/** Libellé d'une catégorie, y compris le filtre spécial "Tous" et les produits sans catégorie (legacy). */
export function categoryLabel(cat: "Tous" | ProductCategory | null): string {
  if (cat === "Tous") return "Tous";
  if (cat === null) return "Sans catégorie";
  return CATEGORY_LABELS[cat];
}

/** Produits mis en avant sur la Home : les articles badgés d'abord, puis le reste, dans l'ordre du catalogue. */
export function newestProducts(products: Product[], limit = 4): Product[] {
  const badged = products.filter((p) => p.badge);
  const rest = products.filter((p) => !p.badge);
  return [...badged, ...rest].slice(0, limit);
}

/** Entier stable représentant le jour civil local (change à minuit). */
function localDayKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** Pseudo-aléatoire déterministe dans [0, 1), stable pour une même graine. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Produit vedette de la Home : tiré au sort chaque jour (stable toute la journée, change à minuit)
 * parmi les produits en stock. Repli sur l'ensemble du catalogue si tout est épuisé.
 */
export function productOfTheDay(products: Product[], now: Date = new Date()): Product | undefined {
  const inStock = products.filter((p) => p.stock > 0);
  const pool = inStock.length > 0 ? inStock : products;
  if (pool.length === 0) return undefined;
  const index = Math.floor(seededRandom(localDayKey(now)) * pool.length);
  return pool[index];
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
  /** Limite aux produits ajoutés pendant la semaine en cours ou la semaine précédente (lien "Nouveautés"). */
  isNew: boolean;
}

/** Lundi 00:00 (heure locale) de la semaine contenant `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

/** Vrai si `createdAt` tombe dans la semaine en cours ou la semaine précédente (semaines lundi → dimanche). */
export function isNewProduct(createdAt: string | Date | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const currentWeekStart = startOfWeek(now);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  return created >= previousWeekStart && created < nextWeekStart;
}

/** Filtrage + tri du catalogue pour l'écran Catalogue de la vitrine. */
export function filterCatalog(products: Product[], filters: CatalogFilters): Product[] {
  let list = products.filter((p) => filters.cat === "Tous" || p.cat === filters.cat);
  if (filters.isNew) list = list.filter((p) => isNewProduct(p.createdAt));
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
