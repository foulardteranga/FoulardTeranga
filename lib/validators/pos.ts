import { z } from "zod";
import { POS_PAYMENT_METHODS } from "@/lib/payments/labels";

export const posSaleLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  variantName: z.string().optional().nullable(),
  colorHex: z.string().optional().nullable(),
  qty: z.coerce.number().int().positive(),
  discounted: z.boolean().default(false),
});

export const posSplitPaymentSchema = z.object({
  method: z.enum(POS_PAYMENT_METHODS),
  amount: z.coerce.number().int().positive("Le montant doit être supérieur à 0."),
  amountReceived: z.coerce.number().int().positive().optional().nullable(),
  changeGiven: z.coerce.number().int().min(0).optional().nullable(),
});

export const posSaleSchema = z.object({
  lines: z.array(posSaleLineSchema).min(1, "Le panier est vide."),
  paymentMethod: z.enum(POS_PAYMENT_METHODS),
  amountReceived: z.coerce.number().int().positive().optional().nullable(),
  changeGiven: z.coerce.number().int().min(0).optional().nullable(),
  splitPayments: z.array(posSplitPaymentSchema).optional().nullable(),
  customerId: z.string().min(1).nullable().optional(),
  promoCode: z.string().trim().optional(),
  pointsRequested: z.coerce.number().int().min(0).default(0),
});

/** Création d'une fiche cliente au comptoir (voir ClientBlock dans PosScreen). */
export const createWalkInCustomerSchema = z.object({
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Numéro invalide."),
  name: z.string().trim().min(1, "Nom requis."),
});

export type PosSaleLineInput = z.infer<typeof posSaleLineSchema>;
export type PosSplitPaymentInput = z.infer<typeof posSplitPaymentSchema>;
export type PosSaleInput = z.infer<typeof posSaleSchema>;
export type CreateWalkInCustomerInput = z.infer<typeof createWalkInCustomerSchema>;
