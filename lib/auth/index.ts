import { createClient } from "@/lib/supabase/server";
import { isRoleAllowedForZone, resolveSession } from "./session";
import type { Zone, Session } from "./session";

export * from "./session";

/** Convenience Server Component/Action : construit le client puis résout la session. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  return resolveSession(supabase);
}

export async function requireZone(zone: Zone): Promise<{ allowed: boolean }> {
  const session = await getSession();
  return { allowed: isRoleAllowedForZone(zone, session?.role ?? null) };
}
