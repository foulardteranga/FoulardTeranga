import { headers } from "next/headers";
import { notFound } from "next/navigation";
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

/**
 * Garde des **pages** de la vitrine. Next.js prérend les segments en parallèle :
 * sans elle, une page continuerait d'exécuter ses requêtes catalogue/commandes
 * alors que le layout a déjà décidé de ne pas la rendre. Elle coupe donc le
 * rendu pour tout état non `active` — y compris `suspended`, dont la réponse
 * visible est produite par le layout (`StoreUnavailable`), pas ici.
 */
export async function requireActiveStorefrontTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenantOrNull();
  if (!tenant || tenant.status !== "active") notFound();
  return tenant;
}
