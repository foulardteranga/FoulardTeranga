import { headers } from "next/headers";
import { resolveTenantFromHost } from "./registry";
import type { Tenant } from "./types";

export type { Tenant, ThemeTokens } from "./types";
export { resolveTenantFromHost, TENANTS_CACHE_TAG } from "./registry";

/** Boutique correspondant à l'hôte de la requête, ou `null` si aucune. */
export async function getCurrentTenantOrNull(): Promise<Tenant | null> {
  const h = await headers();
  const host = h.get("x-tenant-host");
  if (!host) return null;
  return resolveTenantFromHost(host);
}

/**
 * Boutique courante, garantie non nulle. Réservé aux contextes où une boutique
 * valide est un invariant (dashboard, Server Actions). La vitrine, seul endroit
 * où un hôte inconnu est un scénario utilisateur légitime, utilise
 * `getCurrentTenantOrNull` et rend un 404.
 */
export async function getCurrentTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenantOrNull();
  if (!tenant) throw new Error("Aucune boutique ne correspond à cet hôte.");
  return tenant;
}
