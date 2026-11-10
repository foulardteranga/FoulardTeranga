import { describe, it, expect } from "vitest";
import {
  categories,
  storefrontCategories,
  newestProducts,
  productOfTheDay,
  relatedTo,
  filterCatalog,
  isNewProduct,
} from "@/lib/data/catalog";
import { toProduct } from "@/lib/data/catalog.server";
import type { Product } from "@/lib/data/types";

const FIXTURE_PRODUCTS: Product[] = [
  { id: "p1", cat: "Foulards", name: "Foulard Wax Abidjan", variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "repeating-linear-gradient(45deg,#e6d9c4,#e6d9c4 8px,#efe6d6 8px,#efe6d6 16px)",
    colors: ["#26326B", "#D07A34", "#C9A227"], motif: "Wax", lengths: ["90 × 90 cm", "Sur-mesure"], badge: "Nouveau", gallery: [],
    description: "Coton wax authentique, imprimé vibrant inspiré des marchés d'Abidjan. Un incontournable du quotidien." },
  { id: "p2", cat: "Foulards", name: "Foulard soie Kente", variant: "Soie · 70×70", price: 22000, stock: 6, swatch: "repeating-linear-gradient(45deg,#d8c9e0,#d8c9e0 8px,#e6dcec 8px,#e6dcec 16px)",
    colors: ["#26326B", "#0E9F6E", "#C9A227"], motif: "Kente", lengths: ["70 × 70 cm", "Sur-mesure"], badge: "★ Coup de cœur", featured: true, gallery: [],
    description: "Soie fluide au toucher précieux, tissage Kente aux couleurs chaudes. Notre pièce signature, en édition limitée." },
  { id: "p3", cat: "Turbans", name: "Turban Bazin Or", variant: "Bazin · brodé", price: 18000, stock: 14, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)",
    colors: ["#C9A227", "#1E1B18"], motif: "Bazin", lengths: ["Taille unique"], gallery: [],
    description: "Bazin riche brodé main, éclat doré pour les grandes occasions." },
  { id: "p4", cat: "Foulards", name: "Foulard mousseline", variant: "Mousseline · 55×55", price: 7000, stock: 31, swatch: "repeating-linear-gradient(45deg,#d5e0dc,#d5e0dc 8px,#e4ece8 8px,#e4ece8 16px)",
    colors: ["#0E9F6E", "#26326B"], motif: "Uni", lengths: ["55 × 55 cm"], gallery: [],
    description: "Mousseline légère et respirante, l'essentiel du quotidien, doux et facile à nouer." },
  { id: "p5", cat: "Voiles", name: "Wax Vlisco 6 yards", variant: "Coton · 6 yd", price: 35000, stock: 9, swatch: "repeating-linear-gradient(45deg,#e0cfc0,#e0cfc0 8px,#ece0d4 8px,#ece0d4 16px)",
    colors: ["#D07A34", "#26326B"], motif: "Wax", lengths: ["6 yards"], gallery: [],
    description: "Wax Vlisco authentique, motifs vibrants pour vos tenues sur-mesure." },
  { id: "p6", cat: "Voiles", name: "Bazin riche", variant: "Damassé · 5 m", price: 28000, stock: 4, swatch: "repeating-linear-gradient(45deg,#cfd8e0,#cfd8e0 8px,#dfe6ec 8px,#dfe6ec 16px)",
    colors: ["#26326B", "#1E1B18"], motif: "Bazin", lengths: ["5 mètres"], oldPrice: 32000, gallery: [],
    description: "Bazin riche damassé, éclat soutenu, pour vos grandes occasions." },
  { id: "p7", cat: "Voiles", name: "Kente bande", variant: "Tissé main · 4 m", price: 40000, stock: 11, swatch: "repeating-linear-gradient(45deg,#e6c9c0,#e6c9c0 8px,#efdcd4 8px,#efdcd4 16px)",
    colors: ["#D07A34", "#C9A227", "#26326B"], motif: "Kente", lengths: ["4 mètres"], badge: "★ VIP", gallery: [],
    description: "Tissage Kente authentique, réalisé à la main, un drapé généreux et précieux." },
  { id: "p8", cat: "Voiles", name: "Pagne Woodin", variant: "Coton · 6 yd", price: 24000, stock: 17, swatch: "repeating-linear-gradient(45deg,#d0ddc9,#d0ddc9 8px,#e0ebda 8px,#e0ebda 16px)",
    colors: ["#0E9F6E", "#D07A34"], motif: "Wax", lengths: ["6 yards"], gallery: [],
    description: "Pagne Woodin coloré, coton de qualité pour vos créations sur-mesure." },
  { id: "p9", cat: "Coiffes", name: "Broche dorée", variant: "Laiton · plaqué", price: 4500, stock: 22, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)",
    colors: ["#C9A227"], motif: "Uni", lengths: ["Taille unique"], gallery: [],
    description: "Broche en laiton plaqué or, l'accent parfait pour relever un foulard ou un turban." },
  { id: "p10", cat: "Coiffes", name: "Boucles perles", variant: "Perles · fait main", price: 6000, stock: 3, swatch: "repeating-linear-gradient(45deg,#e0cfd6,#e0cfd6 8px,#ece0e6 8px,#ece0e6 16px)",
    colors: ["#D07A34", "#1E1B18"], motif: "Uni", lengths: ["Taille unique"], badge: "Nouveau", gallery: [],
    description: "Boucles d'oreilles en perles faites main, légères et élégantes." },
  { id: "p11", cat: "Coiffes", name: "Sac raphia", variant: "Raphia tressé", price: 15000, stock: 8, swatch: "repeating-linear-gradient(45deg,#e2d6bf,#e2d6bf 8px,#ece3d2 8px,#ece3d2 16px)",
    colors: ["#C9A227", "#26326B"], motif: "Uni", lengths: ["Taille unique"], gallery: [],
    description: "Sac en raphia tressé à la main, la touche artisanale qui complète toute tenue." },
  { id: "p12", cat: "Coiffes", name: "Pochette wax", variant: "Wax · doublée", price: 8000, stock: 19, swatch: "repeating-linear-gradient(45deg,#d9d2c4,#d9d2c4 8px,#e7e1d6 8px,#e7e1d6 16px)",
    colors: ["#D07A34", "#0E9F6E"], motif: "Wax", lengths: ["Taille unique"], gallery: [],
    description: "Pochette en wax doublée, pratique et colorée pour vos sorties." },
];

describe("catalog constants", () => {
  it("keeps Turbans in the full category list and in storefrontCategories", () => {
    expect(categories).toContain("Turbans");
    expect(storefrontCategories).toEqual(["Foulards", "Turbans", "Coiffes", "Eventails", "Voiles"]);
  });
});

describe("toProduct", () => {
  it("maps a Prisma row (category) to the app Product shape (cat)", () => {
    const row = {
      id: "p1", tenantId: "foulard-teranga", category: "Foulards" as const, name: "Foulard Wax Abidjan",
      variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "swatch", colors: ["#26326B"], motif: "Wax",
      lengths: ["90 × 90 cm"], description: "desc", oldPrice: null, badge: "Nouveau", featured: false,
      image: null, gallery: [], active: true, archivedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const product = toProduct(row);
    expect(product.cat).toBe("Foulards");
    expect(product.oldPrice).toBeUndefined();
    expect(product.badge).toBe("Nouveau");
    expect(product.image).toBeUndefined();
    expect(product.gallery).toEqual([]);
    expect(product.active).toBe(true);
    expect(product.archivedAt).toBeNull();
  });

  it("maps image and gallery when present", () => {
    const row = {
      id: "p2", tenantId: "foulard-teranga", category: "Foulards" as const, name: "Foulard soie",
      variant: "Soie · 70×70", price: 22000, stock: 6, swatch: "swatch", colors: ["#26326B"], motif: "Kente",
      lengths: ["70 × 70 cm"], description: "desc", oldPrice: null, badge: null, featured: false,
      image: "https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/a.webp",
      gallery: ["https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/b.webp"],
      active: false, archivedAt: new Date("2026-09-24T00:00:00Z"),
      createdAt: new Date(), updatedAt: new Date(),
    };
    const product = toProduct(row);
    expect(product.image).toBe(row.image);
    expect(product.gallery).toEqual(row.gallery);
    expect(product.active).toBe(false);
    expect(product.archivedAt).toBe("2026-09-24T00:00:00.000Z");
  });
});

describe("newestProducts", () => {
  it("returns badged products first, in catalog order", () => {
    expect(newestProducts(FIXTURE_PRODUCTS, 4).map((p) => p.id)).toEqual(["p1", "p2", "p7", "p10"]);
  });

  it("respects the limit", () => {
    expect(newestProducts(FIXTURE_PRODUCTS, 2).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("productOfTheDay", () => {
  it("is stable across calls on the same day", () => {
    const now = new Date("2026-11-10T09:00:00");
    const a = productOfTheDay(FIXTURE_PRODUCTS, now);
    const b = productOfTheDay(FIXTURE_PRODUCTS, new Date("2026-11-10T21:00:00"));
    expect(a!.id).toBe(b!.id);
  });

  it("can change on a different day", () => {
    const picks = new Set<string>();
    for (let day = 1; day <= 15; day++) {
      const pick = productOfTheDay(FIXTURE_PRODUCTS, new Date(2026, 10, day));
      picks.add(pick!.id);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("excludes out-of-stock products when stock remains elsewhere", () => {
    const products = FIXTURE_PRODUCTS.map((p) => (p.id === "p1" ? { ...p, stock: 0 } : { ...p, stock: 0 }));
    products[2] = { ...products[2], stock: 5 };
    const pick = productOfTheDay(products, new Date("2026-11-10T09:00:00"));
    expect(pick!.id).toBe(products[2].id);
  });

  it("returns undefined for an empty catalog", () => {
    expect(productOfTheDay([])).toBeUndefined();
  });
});

describe("relatedTo", () => {
  it("returns same-category products excluding the product itself", () => {
    expect(relatedTo(FIXTURE_PRODUCTS, "p2").map((p) => p.id)).toEqual(["p1", "p4"]);
  });

  it("returns an empty array for an unknown id", () => {
    expect(relatedTo(FIXTURE_PRODUCTS, "nope")).toEqual([]);
  });
});

describe("isNewProduct", () => {
  // Jeudi 12 novembre 2026 : semaine en cours = lun 09/11 → dim 15/11 ; semaine précédente = lun 02/11 → dim 08/11.
  const now = new Date("2026-11-12T10:00:00");

  it("is true for a product created earlier in the current week", () => {
    expect(isNewProduct("2026-11-09T08:00:00", now)).toBe(true);
  });

  it("is true for a product created during the previous week", () => {
    expect(isNewProduct("2026-11-03T08:00:00", now)).toBe(true);
  });

  it("is false for a product created before the previous week", () => {
    expect(isNewProduct("2026-10-26T23:59:59", now)).toBe(false);
  });

  it("is false for a product created after the current week", () => {
    expect(isNewProduct("2026-11-16T00:00:00", now)).toBe(false);
  });

  it("is false when createdAt is missing", () => {
    expect(isNewProduct(undefined, now)).toBe(false);
  });
});

describe("filterCatalog", () => {
  const base = { cat: "Tous" as const, color: "", motif: "", priceMax: 999999, query: "", sort: "new" as const, isNew: false };

  it("filters to products created this week or last week when isNew is set", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 1);
    const old = new Date();
    old.setDate(old.getDate() - 60);
    const products = [
      { ...FIXTURE_PRODUCTS[0], createdAt: recent.toISOString() },
      { ...FIXTURE_PRODUCTS[1], createdAt: old.toISOString() },
    ];
    expect(filterCatalog(products, { ...base, isNew: true }).map((p) => p.id)).toEqual(["p1"]);
  });

  it("returns everything with no filters", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, base)).toHaveLength(12);
  });

  it("filters by category", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, cat: "Turbans" }).map((p) => p.id)).toEqual(["p3"]);
  });

  it("filters by color (gold present on p3, absent on p4)", () => {
    const result = filterCatalog(FIXTURE_PRODUCTS, { ...base, color: "#C9A227" }).map((p) => p.id);
    expect(result).toContain("p3");
    expect(result).not.toContain("p4");
  });

  it("filters by motif", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, motif: "Kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("filters by max price inclusive", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, priceMax: 8000 }).map((p) => p.id)).toEqual(["p4", "p9", "p10", "p12"]);
  });

  it("filters by free-text query on name or motif", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, query: "kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("sorts ascending by price", () => {
    expect(filterCatalog(FIXTURE_PRODUCTS, { ...base, cat: "Coiffes", sort: "asc" }).map((p) => p.id)).toEqual([
      "p9", "p10", "p12", "p11",
    ]);
  });
});
