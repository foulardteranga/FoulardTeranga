"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateLogin, type LoginFieldErrors } from "@/lib/validators/auth";
import { dashboardPath } from "@/lib/proxy/zones";

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
  // N'accepte qu'un chemin relatif de même origine : un seul "/" en tête, ni
  // "//" (URL protocole-relative) ni "/\" (certains navigateurs normalisent
  // un backslash en "/", ce qui reproduit le même contournement).
  const safeNext = /^\/(?!\/|\\)/.test(next) ? next : "/pos";
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(dashboardPath(hostname, safeNext));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(dashboardPath(hostname, "/connexion"));
}
