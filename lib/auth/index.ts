import { createClient } from "@/lib/supabase/server";
import { isRoleAllowedForZone } from "./session";
import { resolveEffectiveSession } from "@/lib/impersonation/context";
import type { Zone, Session } from "./session";

export * from "./session";

/**
 * Convenience Server Component/Action : construit le client puis résout
 * l'identité EFFECTIVE (celle de la cible en impersonation, celle de l'acteur
 * sinon). Tout le dashboard existant continue de fonctionner sans changement
 * — c'est délibéré (spec §3). Pour l'acteur réel (audit, bandeau), utiliser
 * `getActorContext()` (lib/impersonation/context.ts).
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  return resolveEffectiveSession(supabase);
}

export async function requireZone(zone: Zone): Promise<{ allowed: boolean }> {
  const session = await getSession();
  return { allowed: isRoleAllowedForZone(zone, session?.role ?? null) };
}
