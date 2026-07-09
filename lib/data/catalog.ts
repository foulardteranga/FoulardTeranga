import type { Product } from "./types";

/** Catalogue produits (données de démonstration). */
export const catalog: Product[] = [
  { id: "p1", cat: "Foulards", name: "Foulard Wax Abidjan", variant: "Wax · 90×90", price: 12500, stock: 24, swatch: "repeating-linear-gradient(45deg,#e6d9c4,#e6d9c4 8px,#efe6d6 8px,#efe6d6 16px)" },
  { id: "p2", cat: "Foulards", name: "Foulard soie Kente", variant: "Soie · 70×70", price: 22000, stock: 6, swatch: "repeating-linear-gradient(45deg,#d8c9e0,#d8c9e0 8px,#e6dcec 8px,#e6dcec 16px)" },
  { id: "p3", cat: "Foulards", name: "Turban Bazin Or", variant: "Bazin · brodé", price: 18000, stock: 14, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)" },
  { id: "p4", cat: "Foulards", name: "Foulard mousseline", variant: "Mousseline · 55×55", price: 7000, stock: 31, swatch: "repeating-linear-gradient(45deg,#d5e0dc,#d5e0dc 8px,#e4ece8 8px,#e4ece8 16px)" },
  { id: "p5", cat: "Tissus", name: "Wax Vlisco 6 yards", variant: "Coton · 6 yd", price: 35000, stock: 9, swatch: "repeating-linear-gradient(45deg,#e0cfc0,#e0cfc0 8px,#ece0d4 8px,#ece0d4 16px)" },
  { id: "p6", cat: "Tissus", name: "Bazin riche", variant: "Damassé · 5 m", price: 28000, stock: 4, swatch: "repeating-linear-gradient(45deg,#cfd8e0,#cfd8e0 8px,#dfe6ec 8px,#dfe6ec 16px)" },
  { id: "p7", cat: "Tissus", name: "Kente bande", variant: "Tissé main · 4 m", price: 40000, stock: 11, swatch: "repeating-linear-gradient(45deg,#e6c9c0,#e6c9c0 8px,#efdcd4 8px,#efdcd4 16px)" },
  { id: "p8", cat: "Tissus", name: "Pagne Woodin", variant: "Coton · 6 yd", price: 24000, stock: 17, swatch: "repeating-linear-gradient(45deg,#d0ddc9,#d0ddc9 8px,#e0ebda 8px,#e0ebda 16px)" },
  { id: "p9", cat: "Accessoires", name: "Broche dorée", variant: "Laiton · plaqué", price: 4500, stock: 22, swatch: "repeating-linear-gradient(45deg,#e6dcb4,#e6dcb4 8px,#f0e9cc 8px,#f0e9cc 16px)" },
  { id: "p10", cat: "Accessoires", name: "Boucles perles", variant: "Perles · fait main", price: 6000, stock: 3, swatch: "repeating-linear-gradient(45deg,#e0cfd6,#e0cfd6 8px,#ece0e6 8px,#ece0e6 16px)" },
  { id: "p11", cat: "Accessoires", name: "Sac raphia", variant: "Raphia tressé", price: 15000, stock: 8, swatch: "repeating-linear-gradient(45deg,#e2d6bf,#e2d6bf 8px,#ece3d2 8px,#ece3d2 16px)" },
  { id: "p12", cat: "Accessoires", name: "Pochette wax", variant: "Wax · doublée", price: 8000, stock: 19, swatch: "repeating-linear-gradient(45deg,#d9d2c4,#d9d2c4 8px,#e7e1d6 8px,#e7e1d6 16px)" },
];

export const categories: Array<"Tous" | Product["cat"]> = [
  "Tous",
  "Foulards",
  "Tissus",
  "Accessoires",
];
