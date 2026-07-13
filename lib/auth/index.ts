export type Zone = "storefront" | "dashboard" | "admin";
export type Role = "owner" | "staff" | "super_admin";

export interface Session {
  userId: string;
  name: string;
  role: Role;
}

/**
 * Placeholder v1 : pas d'authentification réelle. Renvoie toujours la même
 * session "gérante" mock. Quand Supabase Auth sera branché, seule cette
 * fonction change — les appelants (`requireZone`, `proxy.ts`) restent stables.
 */
export function getSession(): Session {
  return { userId: "owner-1", name: "Aïcha Koné", role: "owner" };
}

const ZONE_ROLES: Record<Exclude<Zone, "storefront">, Role[]> = {
  dashboard: ["owner", "staff"],
  admin: ["super_admin"],
};

export function requireZone(zone: Zone): { allowed: boolean } {
  if (zone === "storefront") return { allowed: true };
  const session = getSession();
  return { allowed: ZONE_ROLES[zone].includes(session.role) };
}
