import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { resolveActorContext } from "./context";

/** Spec §11 : jamais un échec muet, toujours une invitation explicite. */
export const READ_ONLY_ERROR = "Lecture seule : activez le mode intervention pour modifier ces données.";

/** Une boutique suspendue ou archivée bloque toute écriture dashboard, pas
 * seulement son accès (Tâche 17, trouvé par la revue finale de la phase 4) :
 * un onglet déjà ouvert au moment de la suspension, ou un panier hors-ligne
 * PWA qui se resynchronise après coup, continuerait sinon d'écrire malgré le
 * back-office « bloqué ». */
export const TENANT_NOT_ACTIVE_ERROR = "Cette boutique n'est pas active : les modifications sont désactivées.";

export type WritableSessionResult = { ok: true } | { ok: false; error: string };

/**
 * Garde primaire de l'écriture (spec §3, étendu Tâche 17). Composé dans
 * chaque garde d'écriture existant (`requireOwnerSession` et équivalents) —
 * jamais la RLS, qui voit toujours le JWT du super-admin. Deux motifs de
 * refus distincts, avec des messages distincts : mode lecture seule
 * d'impersonation, et boutique non active — le second s'applique QUE
 * l'appelant soit en impersonation ou non, un owner/staff normal compris.
 * Vérifie aussi que le `tenantId` de l'impersonation correspond à la boutique
 * de la requête courante (résolue par l'hôte) : inerte tant qu'une seule
 * boutique existe, mais ferme la faille avant qu'une deuxième n'apparaisse
 * (multi-boutique futur, CLAUDE.md §1).
 */
export async function requireWritableSession(): Promise<WritableSessionResult> {
  const supabase = await createClient();
  const ctx = await resolveActorContext(supabase);
  if (!ctx) return { ok: false, error: READ_ONLY_ERROR };

  if (ctx.impersonation) {
    if (ctx.impersonation.mode === "read") return { ok: false, error: READ_ONLY_ERROR };
  }

  try {
    const tenant = await getCurrentTenant();
    if (ctx.impersonation && ctx.impersonation.tenantId !== tenant.id) {
      return { ok: false, error: READ_ONLY_ERROR };
    }
    if (tenant.status !== "active") {
      return { ok: false, error: TENANT_NOT_ACTIVE_ERROR };
    }
  } catch {
    // Hôte non résolu (spec §9 : échec fermé, jamais un 500 en garde d'écriture).
    return { ok: false, error: READ_ONLY_ERROR };
  }

  return { ok: true };
}
