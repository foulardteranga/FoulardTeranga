import { z } from "zod";

/** Champs de création d'un code promo (écran Marketing). Dates au format YYYY-MM-DD (input date natif). */
export const promoCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "3 à 20 lettres ou chiffres, sans espace.")),
    kind: z.enum(["percent", "amount"]),
    value: z.coerce.number().int().positive(),
    minTotal: z.coerce.number().int().positive().optional(),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    vipOnly: z.boolean().default(false),
  })
  .refine((d) => d.kind !== "percent" || (d.value >= 1 && d.value <= 100), {
    message: "Un pourcentage doit être entre 1 et 100.",
    path: ["value"],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt <= d.endsAt, {
    message: "La fin doit être après le début.",
    path: ["endsAt"],
  });

export type PromoCreateInput = z.infer<typeof promoCreateSchema>;
