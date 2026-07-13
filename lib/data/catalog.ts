import type { Product, ProductCategory } from "./types";

/** Catalogue produits (données de démonstration) — source unique partagée entre POS, inventaire et vitrine. */
export const catalog: Product[] = [
  { id: "p1", cat: "Foulards", name: "Foulard Wax Abidjan", variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "repeating-linear-gradient(45deg,#e6d9c4,#e6d9c4 8px,#efe6d6 8px,#efe6d6 16px)",
    colors: ["#26326B", "#D07A34", "#C9A227"], motif: "Wax", lengths: ["90 × 90 cm", "Sur-mesure"], badge: "Nouveau",
    description: "Coton wax authentique, imprimé vibrant inspiré des marchés d'Abidjan. Un incontournable du quotidien." },
  { id: "p2", cat: "Foulards", name: "Foulard soie Kente", variant: "Soie · 70×70", price: 22000, stock: 6, swatch: "repeating-linear-gradient(45deg,#d8c9e0,#d8c9e0 8px,#e6dcec 8px,#e6dcec 16px)",
    colors: ["#26326B", "#0E9F6E", "#C9A227"], motif: "Kente", lengths: ["70 × 70 cm", "Sur-mesure"], badge: "★ Coup de cœur", featured: true,
    description: "Soie fluide au toucher précieux, tissage Kente aux couleurs chaudes. Notre pièce signature, en édition limitée." },
  { id: "p3", cat: "Turbans", name: "Turban Bazin Or", variant: "Bazin · brodé", price: 18000, stock: 14, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)",
    colors: ["#C9A227", "#1E1B18"], motif: "Bazin", lengths: ["Taille unique"],
    description: "Bazin riche brodé main, éclat doré pour les grandes occasions." },
  { id: "p4", cat: "Foulards", name: "Foulard mousseline", variant: "Mousseline · 55×55", price: 7000, stock: 31, swatch: "repeating-linear-gradient(45deg,#d5e0dc,#d5e0dc 8px,#e4ece8 8px,#e4ece8 16px)",
    colors: ["#0E9F6E", "#26326B"], motif: "Uni", lengths: ["55 × 55 cm"],
    description: "Mousseline légère et respirante, l'essentiel du quotidien, doux et facile à nouer." },
  { id: "p5", cat: "Tissus", name: "Wax Vlisco 6 yards", variant: "Coton · 6 yd", price: 35000, stock: 9, swatch: "repeating-linear-gradient(45deg,#e0cfc0,#e0cfc0 8px,#ece0d4 8px,#ece0d4 16px)",
    colors: ["#D07A34", "#26326B"], motif: "Wax", lengths: ["6 yards"],
    description: "Wax Vlisco authentique, motifs vibrants pour vos tenues sur-mesure." },
  { id: "p6", cat: "Tissus", name: "Bazin riche", variant: "Damassé · 5 m", price: 28000, stock: 4, swatch: "repeating-linear-gradient(45deg,#cfd8e0,#cfd8e0 8px,#dfe6ec 8px,#dfe6ec 16px)",
    colors: ["#26326B", "#1E1B18"], motif: "Bazin", lengths: ["5 mètres"], oldPrice: 32000,
    description: "Bazin riche damassé, éclat soutenu, pour vos grandes occasions." },
  { id: "p7", cat: "Tissus", name: "Kente bande", variant: "Tissé main · 4 m", price: 40000, stock: 11, swatch: "repeating-linear-gradient(45deg,#e6c9c0,#e6c9c0 8px,#efdcd4 8px,#efdcd4 16px)",
    colors: ["#D07A34", "#C9A227", "#26326B"], motif: "Kente", lengths: ["4 mètres"], badge: "★ VIP",
    description: "Tissage Kente authentique, réalisé à la main, un drapé généreux et précieux." },
  { id: "p8", cat: "Tissus", name: "Pagne Woodin", variant: "Coton · 6 yd", price: 24000, stock: 17, swatch: "repeating-linear-gradient(45deg,#d0ddc9,#d0ddc9 8px,#e0ebda 8px,#e0ebda 16px)",
    colors: ["#0E9F6E", "#D07A34"], motif: "Wax", lengths: ["6 yards"],
    description: "Pagne Woodin coloré, coton de qualité pour vos créations sur-mesure." },
  { id: "p9", cat: "Accessoires", name: "Broche dorée", variant: "Laiton · plaqué", price: 4500, stock: 22, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)",
    colors: ["#C9A227"], motif: "Uni", lengths: ["Taille unique"],
    description: "Broche en laiton plaqué or, l'accent parfait pour relever un foulard ou un turban." },
  { id: "p10", cat: "Accessoires", name: "Boucles perles", variant: "Perles · fait main", price: 6000, stock: 3, swatch: "repeating-linear-gradient(45deg,#e0cfd6,#e0cfd6 8px,#ece0e6 8px,#ece0e6 16px)",
    colors: ["#D07A34", "#1E1B18"], motif: "Uni", lengths: ["Taille unique"], badge: "Nouveau",
    description: "Boucles d'oreilles en perles faites main, légères et élégantes." },
  { id: "p11", cat: "Accessoires", name: "Sac raphia", variant: "Raphia tressé", price: 15000, stock: 8, swatch: "repeating-linear-gradient(45deg,#e2d6bf,#e2d6bf 8px,#ece3d2 8px,#ece3d2 16px)",
    colors: ["#C9A227", "#26326B"], motif: "Uni", lengths: ["Taille unique"],
    description: "Sac en raphia tressé à la main, la touche artisanale qui complète toute tenue." },
  { id: "p12", cat: "Accessoires", name: "Pochette wax", variant: "Wax · doublée", price: 8000, stock: 19, swatch: "repeating-linear-gradient(45deg,#d9d2c4,#d9d2c4 8px,#e7e1d6 8px,#e7e1d6 16px)",
    colors: ["#D07A34", "#0E9F6E"], motif: "Wax", lengths: ["Taille unique"],
    description: "Pochette en wax doublée, pratique et colorée pour vos sorties." },
];

export const categories: Array<"Tous" | ProductCategory> = [
  "Tous",
  "Foulards",
  "Turbans",
  "Tissus",
  "Accessoires",
];

/** Catégories mises en avant sur la Home (les Tissus restent filtrables au catalogue mais hors vignettes). */
export const storefrontCategories: ProductCategory[] = ["Foulards", "Turbans", "Accessoires"];

/** Produits mis en avant sur la Home : les articles badgés d'abord, puis le reste, dans l'ordre du catalogue. */
export function newestProducts(limit = 4): Product[] {
  const badged = catalog.filter((p) => p.badge);
  const rest = catalog.filter((p) => !p.badge);
  return [...badged, ...rest].slice(0, limit);
}

/** Le produit vedette de la Home (le premier marqué `featured`, sinon le premier du catalogue). */
export function featuredProduct(): Product {
  return catalog.find((p) => p.featured) ?? catalog[0];
}

/** Produits de la même catégorie, hors le produit lui-même. */
export function relatedTo(productId: string, limit = 4): Product[] {
  const current = catalog.find((p) => p.id === productId);
  if (!current) return [];
  return catalog.filter((p) => p.cat === current.cat && p.id !== current.id).slice(0, limit);
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
export function filterCatalog(filters: CatalogFilters): Product[] {
  let list = catalog.filter((p) => filters.cat === "Tous" || p.cat === filters.cat);
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
