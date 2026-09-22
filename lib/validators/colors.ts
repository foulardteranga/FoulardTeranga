import { z } from "zod";

export const customColorSchema = z.object({
  name: z.string().trim().min(1, "Nom de couleur requis."),
  hex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Code HEX invalide (ex: #6B1D2F)."),
  family: z.string().trim().optional(),
  isFavorite: z.boolean().default(false),
});

export type CustomColorInput = z.infer<typeof customColorSchema>;
