import { z } from "zod";

export const PRODUCT_CATEGORIES = ["Foulards", "Turbans", "Tissus", "Accessoires"] as const;

export const productSchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
  name: z.string().trim().min(2, "Nom du produit requis."),
  variant: z.string().trim().min(1, "Variante requise."),
  motif: z.string().trim().min(1, "Motif requis."),
  price: z.coerce.number().int().positive("Prix invalide."),
  stock: z.coerce.number().int().min(0, "Stock invalide."),
  swatch: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  image: z.url().optional(),
  gallery: z.array(z.url()).default([]),
  lengths: z.string().trim().default(""),
  description: z.string().trim().default(""),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Mise à jour des photos d'un produit existant (drawer d'édition, section Photos). */
export const productImagesSchema = z.object({
  image: z.url().nullable(),
  gallery: z.array(z.url()),
});
export type ProductImagesInput = z.infer<typeof productImagesSchema>;
