"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateLogin, type LoginFieldErrors } from "@/lib/validators/auth";

export type SignInState = { ok: false; errors: LoginFieldErrors; formError?: string } | null;

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const result = validateLogin({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { ok: false, errors: result.errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { ok: false, errors: {}, formError: "Email ou mot de passe incorrect." };

  const next = String(formData.get("next") ?? "/pos");
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
