import { z } from "zod";

export const posSaleLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  discounted: z.boolean().default(false),
});

export const posSaleSchema = z.object({
  lines: z.array(posSaleLineSchema).min(1, "Le panier est vide."),
  paymentMethod: z.enum(["espece", "mm", "mixte"]),
  customerId: z.string().min(1).nullable().optional(),
});

export type PosSaleLineInput = z.infer<typeof posSaleLineSchema>;
export type PosSaleInput = z.infer<typeof posSaleSchema>;
