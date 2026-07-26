import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";
import type { Tenant } from "./types";

/** Étiquette de cache à invalider après toute mutation de boutique. */
export const TENANTS_CACHE_TAG = "tenants";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  logoText: string;
  domains: string[];
}

function toTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    theme: {
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      logoText: row.logoText,
    },
    domains: row.domains,
  };
}

/**
 * Charge le parc entier en une requête plutôt qu'une requête par hôte : la
 * correspondance se fait ensuite en mémoire, et le cache n'a qu'une seule
 * entrée à invalider. Adapté à un parc de quelques dizaines de boutiques.
 */
const loadTenants = unstable_cache(
  async (): Promise<TenantRow[]> =>
    prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        primaryColor: true,
        accentColor: true,
        logoText: true,
        domains: true,
      },
    }),
  ["tenants-all"],
  { tags: [TENANTS_CACHE_TAG] }
);

function stripPort(host: string): string {
  return host.split(":")[0].toLowerCase();
}

/**
 * Résout un hôte vers sa boutique. Renvoie `null` si aucune ne correspond :
 * un repli sur une boutique par défaut afficherait, en multi-boutique, la
 * vitrine d'une cliente sur un domaine qui ne lui appartient pas (spec §2).
 */
export async function resolveTenantFromHost(host: string): Promise<Tenant | null> {
  const normalized = stripPort(host);
  const rows = await loadTenants();

  const bySubdomain = rows.find((t) => normalized === `${t.slug}.plateforme.app`);
  if (bySubdomain) return toTenant(bySubdomain);

  const byDomain = rows.find((t) => t.domains.includes(normalized));
  if (byDomain) return toTenant(byDomain);

  return null;
}
