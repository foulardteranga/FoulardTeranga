import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { resolveActorContext } from "./context";

/** Spec §11 : jamais un échec muet, toujours une invitation explicite. */
export const READ_ONLY_ERROR = "Lecture seule : activez le mode intervention pour modifier ces données.";

/**
 * Garde primaire de l'écriture en impersonation (spec §3). Composé dans
 * chaque garde d'écriture existant (`requireOwnerSession` et équivalents) —
 * jamais la RLS, qui voit toujours le JWT du super-admin. Vérifie aussi que
 * le `tenantId` de l'impersonation correspond à la boutique de la requête
 * courante (résolue par l'hôte) : inerte tant qu'une seule boutique existe,
 * mais ferme la faille avant qu'une deuxième n'apparaisse (multi-boutique
 * futur, CLAUDE.md §1).
 */
export async function requireWritableSession(): Promise<boolean> {
  const supabase = await createClient();
  const ctx = await resolveActorContext(supabase);
  if (!ctx) return false;
  if (ctx.impersonation) {
    if (ctx.impersonation.mode === "read") return false;
    try {
      const tenant = await getCurrentTenant();
      if (ctx.impersonation.tenantId !== tenant.id) return false;
    } catch {
      // Hôte non résolu (spec §9 : échec fermé, jamais un 500 en garde d'écriture).
      return false;
    }
  }
  return true;
}
