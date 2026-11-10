import { z } from "zod";

export const customOrderSchema = z.object({
  clientName: z.string().trim().min(2, "Merci d'indiquer le nom."),
  place: z.string().trim().min(2, "Indiquez où livrer."),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour la joindre."),
  colorName: z.string().trim().max(60).optional(),
  colorHex: z.string().trim().max(9).optional(),
  fabricNote: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  modelImageUrl: z.string().trim().max(600).optional(),
  dueDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional()
  ),
  total: z.coerce.number().int("Le prix doit être un nombre entier.").min(100, "Indiquez un prix."),
  deposit: z.coerce.number().int("L'acompte doit être un nombre entier.").min(0).optional(),
});

export type CustomOrderInput = z.input<typeof customOrderSchema>;
