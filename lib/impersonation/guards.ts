import { createClient } from "@/lib/supabase/server";
import { resolveActorContext } from "./context";

/** Spec §11 : jamais un échec muet, toujours une invitation explicite. */
export const READ_ONLY_ERROR = "Lecture seule : activez le mode intervention pour modifier ces données.";

/**
 * Garde primaire de l'écriture en impersonation (spec §3). Composé dans
 * chaque garde d'écriture existant (`requireOwnerSession` et équivalents) —
 * jamais la RLS, qui voit toujours le JWT du super-admin.
 */
export async function requireWritableSession(): Promise<boolean> {
  const supabase = await createClient();
  const ctx = await resolveActorContext(supabase);
  if (!ctx) return false;
  return !(ctx.impersonation && ctx.impersonation.mode === "read");
}
