import { z } from "zod";

/** Raisons sélectionnables par la gérante (les raisons "vente_*" sont écrites uniquement par le système). */
export const MANUAL_STOCK_REASONS = ["reception", "perte", "correction"] as const;

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, "L'écart ne peut pas être nul."),
  reason: z.enum(MANUAL_STOCK_REASONS),
  note: z.string().trim().max(200).optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
