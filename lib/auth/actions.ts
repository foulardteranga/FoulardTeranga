"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { validateLogin, type LoginFieldErrors } from "@/lib/validators/auth";
import { dashboardPath, platformPath } from "@/lib/proxy/zones";
import { resolveSession } from "@/lib/auth";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/impersonation/cookie";
import { getActorContext } from "@/lib/impersonation/context";
import { recordPlatformAction } from "@/lib/platform/audit";
import { getCurrentTenantOrNull } from "@/lib/tenant";

export type SignInState = { ok: false; errors: LoginFieldErrors; formError?: string } | null;

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  // Spec §2 : une boutique suspendue ou archivée refuse la connexion à son
  // back-office. Contrôlé ici en plus de la page /connexion parce que la Server
  // Action est un point d'entrée indépendant, appelable sans passer par elle.
  const tenant = await getCurrentTenantOrNull();
  if (tenant && tenant.status !== "active") {
    return { ok: false, errors: {}, formError: "L'accès à cette boutique est suspendu. Contactez votre prestataire." };
  }

  const result = validateLogin({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { ok: false, errors: result.errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { ok: false, errors: {}, formError: "Email ou mot de passe incorrect." };
  // Une connexion réussie repart d'une ardoise propre : un cookie
  // d'impersonation resté valide (fenêtre de 60 min) ne doit jamais reprendre
  // silencieusement une session empruntée précédente, sans nouvelle trace
  // d'audit (spec §3).
  (await cookies()).delete(IMPERSONATION_COOKIE_NAME);

  const next = String(formData.get("next") ?? "/pos");
  // N'accepte qu'un chemin relatif de même origine : un seul "/" en tête, ni
  // "//" (URL protocole-relative) ni "/\" (certains navigateurs normalisent
  // un backslash en "/", ce qui reproduit le même contournement).
  const safeNext = /^\/(?!\/|\\)/.test(next) ? next : "/pos";
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(dashboardPath(hostname, safeNext));
}

export async function signOut(): Promise<void> {
  // Résolu AVANT `signOut()` : celui-ci invalide la session dont
  // `getActorContext()` a besoin pour retrouver l'impersonation en cours.
  const ctx = await getActorContext();
  if (ctx?.impersonation) {
    await recordPlatformAction({
      actorId: ctx.actor.userId,
      action: "impersonation_ended",
      tenantId: ctx.impersonation.tenantId,
      targetId: ctx.impersonation.targetProfileId,
    });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  // Une impersonation en cours ne doit pas survivre à la déconnexion du
  // compte (ex. la gérante ciblée) : le cookie serait autrement lié à une
  // session désormais invalidée (spec §3).
  (await cookies()).delete(IMPERSONATION_COOKIE_NAME);
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
  // Voir signIn() : une connexion réussie repart d'une ardoise propre.
  (await cookies()).delete(IMPERSONATION_COOKIE_NAME);

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
  // Résolu AVANT `signOut()` : celui-ci invalide la session dont
  // `getActorContext()` a besoin pour retrouver l'impersonation en cours.
  const ctx = await getActorContext();
  if (ctx?.impersonation) {
    await recordPlatformAction({
      actorId: ctx.actor.userId,
      action: "impersonation_ended",
      tenantId: ctx.impersonation.tenantId,
      targetId: ctx.impersonation.targetProfileId,
    });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  // Une impersonation en cours ne doit pas survivre à la déconnexion du
  // prestataire : le cookie serait autrement lié à une session désormais
  // invalidée (spec §3).
  (await cookies()).delete(IMPERSONATION_COOKIE_NAME);
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(platformPath(hostname, "/connexion"));
}
