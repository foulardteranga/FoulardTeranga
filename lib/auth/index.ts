import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Zone = "storefront" | "dashboard" | "admin";
export type Role = "owner" | "staff" | "super_admin" | "customer";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  /** Modules dashboard autorisés — pertinent uniquement pour `staff` (cf. hasModuleAccess). Toujours [] pour owner/super_admin/customer. */
  permissions: string[];
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
 * Accès à un module du dashboard : `owner` a toujours accès complet, `staff`
 * uniquement aux modules listés dans son `EmployeeRole.permissions`. La
 * gestion d'équipe ("equipe") n'est volontairement PAS un module régulier —
 * elle se vérifie séparément via `session.role === "owner"` (cf.
 * docs/superpowers/specs/2026-07-22-team-employee-profiles-design.md §1).
 */
export function hasModuleAccess(session: Session | null, moduleId: string): boolean {
  if (!session) return false;
  if (session.role === "owner") return true;
  if (session.role !== "staff") return false;
  return session.permissions.includes(moduleId);
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
    .select("role, name, active, employeeRole:EmployeeRole(permissions)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  if (profile.active === false) return null;

  const role = profile.role as Role;
  const employeeRole = profile.employeeRole as unknown as { permissions: string[] } | null;
  const permissions = role === "staff" ? (employeeRole?.permissions ?? []) : [];

  return { userId: user.id, name: profile.name, role, permissions };
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
