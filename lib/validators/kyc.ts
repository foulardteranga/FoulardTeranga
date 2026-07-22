import { z } from "zod";

export const kycSchema = z.object({
  name: z.string().trim().min(2, "Merci d'indiquer votre nom."),
  place: z.string().trim().min(2, "Indiquez où livrer."),
  // Format international libre : la boutique est à Abidjan (+225) mais reçoit des
  // commandes de toute la sous-région ou d'ailleurs — pas de préfixe verrouillé.
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour vous joindre."),
  note: z.string().trim().optional().default(""),
  wa: z.boolean().default(true),
});

export type KycInput = z.infer<typeof kycSchema>;

export interface KycFieldErrors {
  name?: string;
  place?: string;
  phone?: string;
}

export interface KycRawInput {
  name: string;
  place: string;
  phone: string;
  note: string;
  wa: boolean;
}

export function validateKyc(
  input: KycRawInput
): { ok: true; data: KycInput } | { ok: false; errors: KycFieldErrors } {
  const result = kycSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: KycFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "place" || key === "phone") {
      errors[key] = issue.message;
    }
  }
  return { ok: false, errors };
}
