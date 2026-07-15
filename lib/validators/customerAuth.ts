import { z } from "zod";

export const customerSignupSchema = z.object({
  name: z.string().trim().min(2, "Merci d'indiquer votre nom."),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour vous joindre."),
  place: z.string().trim().min(2, "Indiquez votre lieu de livraison habituel."),
  email: z.string().trim().email("Adresse email invalide."),
  password: z.string().min(6, "6 caractères minimum."),
});

export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;

export interface CustomerSignupFieldErrors {
  name?: string;
  phone?: string;
  place?: string;
  email?: string;
  password?: string;
}

export interface CustomerSignupRawInput {
  name: string;
  phone: string;
  place: string;
  email: string;
  password: string;
}

export function validateCustomerSignup(
  input: CustomerSignupRawInput
): { ok: true; data: CustomerSignupInput } | { ok: false; errors: CustomerSignupFieldErrors } {
  const result = customerSignupSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: CustomerSignupFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "phone" || key === "place" || key === "email" || key === "password") {
      errors[key] = issue.message;
    }
  }
  return { ok: false, errors };
}
