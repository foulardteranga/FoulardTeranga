import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Zone = "storefront" | "dashboard" | "admin";
export type Role = "owner" | "staff" | "super_admin" | "customer";

export interface Session {
  userId: string;
  name: string;
  role: Role;
}

const ZONE_ROLES: Record<Exclude<Zone, "storefront">, Role[]> = {
  dashboard: ["owner", "staff"],
  admin: ["super_admin"],
};

/** Pure : aucune dépendance réseau, testable directement. */
export function isRoleAllowedForZone(zone: Zone, role: Role | null): boolean {
  if (zone === "storefront") return true;
  if (!role) return false;
  return ZONE_ROLES[zone].includes(role);
}

/**
 * Résout la session à partir d'un client Supabase déjà construit — factorisé
 * pour être appelable aussi bien depuis un contexte Server Component/Action
 * (lib/supabase/server.ts) que depuis proxy.ts en Edge (lib/supabase/middleware.ts),
 * qui n'ont pas la même API de cookies.
 */
export async function resolveSession(supabase: SupabaseClient): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("Profile")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { userId: user.id, name: profile.name, role: profile.role as Role };
}

/** Convenience Server Component/Action : construit le client puis résout la session. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  return resolveSession(supabase);
}

export async function requireZone(zone: Zone): Promise<{ allowed: boolean }> {
  const session = await getSession();
  return { allowed: isRoleAllowedForZone(zone, session?.role ?? null) };
}
