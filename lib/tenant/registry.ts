import type { Tenant } from "./types";

/**
 * v1 mono-boutique : un seul tenant. La résolution ci-dessous reste réelle
 * (host → tenant) pour que l'ajout d'un 2e tenant soit un ajout de données,
 * jamais une réécriture de cette logique.
 */
export const DEFAULT_TENANT: Tenant = {
  id: "foulard-teranga",
  slug: "foulard-teranga",
  name: "Foulard Teranga",
  theme: {
    primaryColor: "#26326B",
    accentColor: "#D07A34",
    logoText: "Foulard Teranga",
  },
  domains: ["localhost", "foulard-teranga.localhost"],
};

export const TENANTS: Tenant[] = [DEFAULT_TENANT];

function stripPort(host: string): string {
  return host.split(":")[0].toLowerCase();
}

export function resolveTenantFromHost(host: string): Tenant {
  const normalized = stripPort(host);

  const bySubdomain = TENANTS.find((t) => normalized === `${t.slug}.plateforme.app`);
  if (bySubdomain) return bySubdomain;

  const byDomain = TENANTS.find((t) => t.domains.includes(normalized));
  if (byDomain) return byDomain;

  return DEFAULT_TENANT;
}
