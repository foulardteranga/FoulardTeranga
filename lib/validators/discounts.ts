import { z } from "zod";

/** Remises demandées avec une commande web ou en prévisualisation. */
export const discountRequestSchema = z.object({
  promoCode: z.string().trim().max(40).optional(),
  pointsRequested: z.coerce.number().int().min(0).catch(0).default(0),
});

export type DiscountRequestInput = z.input<typeof discountRequestSchema>;
