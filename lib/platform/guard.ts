import { getSession, type Session } from "@/lib/auth";

/**
 * Session du prestataire, ou `null` si l'appelant n'en est pas un. Forme
 * destinée aux Server Actions, qui renvoient un résultat typé plutôt que de
 * lever (CLAUDE.md §8).
 */
export async function currentSuperAdmin(): Promise<Session | null> {
  const session = await getSession();
  return session?.role === "super_admin" ? session : null;
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
