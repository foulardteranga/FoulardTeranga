import type { SupabaseClient } from "@supabase/supabase-js";

export type Zone = "storefront" | "dashboard" | "admin";
export type Role = "owner" | "staff" | "super_admin" | "customer";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  /** Boutique de rattachement. `null` pour un compte plateforme (super_admin). */
  tenantId: string | null;
  /** Modules dashboard autorisés — pertinent uniquement pour `staff`. Toujours [] pour owner/super_admin/customer. */
  permissions: string[];
  /** Modules activés pour la boutique (Tenant.enabledModules). Borne supérieure de tout accès. */
  enabledModules: string[];
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
 * Accès à un module du dashboard : intersection entre le périmètre accordé à
 * la boutique par le prestataire (`enabledModules`) et le droit de la personne.
 * `owner` a tout ce que sa boutique a — mais rien de plus (spec §4). La gestion
 * d'équipe ("equipe") n'est volontairement PAS un module régulier : elle se
 * vérifie séparément via `session.role === "owner"`.
 */
export function hasModuleAccess(session: Session | null, moduleId: string): boolean {
  if (!session) return false;
  if (!session.enabledModules.includes(moduleId)) return false;
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
    .select(
      "role, name, active, tenantId, employeeRole:EmployeeRole(permissions), tenant:Tenant(enabledModules)"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  if (profile.active === false) return null;

  const role = profile.role as Role;
  const employeeRole = profile.employeeRole as unknown as { permissions: string[] } | null;
  const tenant = profile.tenant as unknown as { enabledModules: string[] } | null;
  const permissions = role === "staff" ? (employeeRole?.permissions ?? []) : [];

  return {
    userId: user.id,
    name: profile.name,
    role,
    tenantId: (profile.tenantId as string | null) ?? null,
    permissions,
    enabledModules: tenant?.enabledModules ?? [],
  };
}
