import { z } from "zod";

export const orderArchiveSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});
export type OrderArchiveInput = z.infer<typeof orderArchiveSchema>;

export const orderDeleteSchema = z.object({
  reason: z.string().trim().min(3, "Merci d'indiquer un motif.").max(500),
});
export type OrderDeleteInput = z.infer<typeof orderDeleteSchema>;
