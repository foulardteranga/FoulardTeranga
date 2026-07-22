import { z } from "zod";

export const themeSchema = z.object({
  shopName: z.string().trim().min(2, "Le nom de la boutique est requis."),
  tagline: z.string().trim().max(120, "120 caractères maximum.").default(""),
  primary: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  font: z.enum(["Playfair Display", "Inter"]),
  // Coordonnée affichée sur la vitrine (lien wa.me) — libre, pas de préfixe verrouillé.
  phone: z.string().trim().regex(/^[0-9+()\-\s]{0,20}$/, "Numéro invalide.").optional().default(""),
});

export type ThemeInput = z.infer<typeof themeSchema>;
