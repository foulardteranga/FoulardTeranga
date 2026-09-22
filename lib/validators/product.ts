import { z } from "zod";

export const PRODUCT_CATEGORIES = ["Foulards", "Turbans", "Tissus", "Accessoires"] as const;

/** N'accepte que les URLs publiques de notre bucket Supabase Storage (anti-injection d'URL externe). */
function isAllowedProductImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  return url.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/storefront-images/`);
}

const productImageUrl = z.url().refine(isAllowedProductImageUrl, "URL d'image non autorisée.");

export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  colorName: z.string().trim().min(1, "Nom de couleur requis."),
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur HEX invalide."),
  stock: z.coerce.number().int().min(0, "Stock invalide."),
  sku: z.string().trim().optional().nullable(),
  image: productImageUrl.optional().nullable(),
  active: z.boolean().default(true),
  position: z.coerce.number().int().default(0),
});
export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;

export const productSchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
  name: z.string().trim().min(2, "Nom du produit requis."),
  variant: z.string().trim().min(1, "Variante requise."),
  motif: z.string().trim().min(1, "Motif requis."),
  price: z.coerce.number().int().positive("Prix invalide."),
  stock: z.coerce.number().int().min(0, "Stock invalide."),
  swatch: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  image: productImageUrl.optional(),
  gallery: z.array(productImageUrl).default([]),
  lengths: z.string().trim().default(""),
  description: z.string().trim().default(""),
  variants: z.array(productVariantInputSchema).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Mise à jour des photos d'un produit existant (drawer d'édition, section Photos). */
export const productImagesSchema = z.object({
  image: productImageUrl.nullable(),
  gallery: z.array(productImageUrl),
});
export type ProductImagesInput = z.infer<typeof productImagesSchema>;
