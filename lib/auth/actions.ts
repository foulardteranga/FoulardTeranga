"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateLogin, type LoginFieldErrors } from "@/lib/validators/auth";
import { dashboardPath, platformPath } from "@/lib/proxy/zones";
import { resolveSession } from "@/lib/auth";

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

/**
 * Connexion à la zone plateforme. Vérifie le rôle après authentification et
 * déconnecte sinon : un compte de gérante authentifié puis refusé par `proxy.ts`
 * rebondirait indéfiniment entre /connexion et /boutiques, sans message.
 */
export async function signInPlatform(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const result = validateLogin({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { ok: false, errors: result.errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { ok: false, errors: {}, formError: "Email ou mot de passe incorrect." };

  const session = await resolveSession(supabase);
  if (session?.role !== "super_admin") {
    await supabase.auth.signOut();
    return { ok: false, errors: {}, formError: "Ce compte n'a pas accès à l'espace plateforme." };
  }

  const next = String(formData.get("next") ?? "/boutiques");
  // Même garde que signIn : un seul "/" en tête, ni "//" ni "/\".
  const safeNext = /^\/(?!\/|\\)/.test(next) ? next : "/boutiques";
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(platformPath(hostname, safeNext));
}

export async function signOutPlatform(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(platformPath(hostname, "/connexion"));
}
