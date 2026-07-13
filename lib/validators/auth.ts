import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Adresse email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export interface LoginRawInput {
  email: string;
  password: string;
}

export function validateLogin(
  input: LoginRawInput
): { ok: true; data: LoginInput } | { ok: false; errors: LoginFieldErrors } {
  const result = loginSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: LoginFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key === "email" || key === "password") errors[key] = issue.message;
  }
  return { ok: false, errors };
}
