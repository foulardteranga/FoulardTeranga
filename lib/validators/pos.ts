import { z } from "zod";
import { POS_PAYMENT_METHODS } from "@/lib/payments/labels";

export const posSaleLineSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  discounted: z.boolean().default(false),
});

export const posSaleSchema = z.object({
  lines: z.array(posSaleLineSchema).min(1, "Le panier est vide."),
  paymentMethod: z.enum(POS_PAYMENT_METHODS),
  customerId: z.string().min(1).nullable().optional(),
  promoCode: z.string().trim().optional(),
  pointsRequested: z.coerce.number().int().min(0).default(0),
});

export type PosSaleLineInput = z.infer<typeof posSaleLineSchema>;
export type PosSaleInput = z.infer<typeof posSaleSchema>;
