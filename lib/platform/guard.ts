import type { Session } from "@/lib/auth";
import { getActorContext } from "@/lib/impersonation/context";

/**
 * Session du prestataire, ou `null` si l'appelant n'en est pas un. Forme
 * destinée aux Server Actions, qui renvoient un résultat typé plutôt que de
 * lever (CLAUDE.md §8).
 *
 * Vérifie l'acteur RÉEL (`getActorContext().actor`), pas l'identité effective
 * (`getSession()`) : pendant une impersonation, `getSession()` renvoie la
 * cible (owner/staff), ce qui rendrait un super_admin en cours d'intervention
 * inopinément exclu de sa propre console plateforme (spec §3 — cf. le bug
 * corrigé dans proxy.ts pour la même raison).
 */
export async function currentSuperAdmin(): Promise<Session | null> {
  const ctx = await getActorContext();
  if (!ctx || ctx.actor.role !== "super_admin") return null;
  // Le compte plateforme n'a jamais de tenantId/permissions/enabledModules —
  // vrai qu'il soit ou non en cours d'impersonation d'une boutique (spec §1.3).
  return {
    userId: ctx.actor.userId,
    name: ctx.actor.name,
    role: "super_admin",
    tenantId: null,
    permissions: [],
    enabledModules: [],
  };
}

/**
 * Forme destinée aux Server Components de la zone plateforme, déjà protégés par
 * le layout : y arriver sans être `super_admin` est un défaut de garde, pas un
 * cas utilisateur — il doit être bruyant.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await currentSuperAdmin();
  if (!session) throw new Error("Accès plateforme refusé.");
  return session;
}
