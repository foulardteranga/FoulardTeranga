import { prisma } from "@/lib/db/client";
import { requireSuperAdmin } from "./guard";
import { ADMIN_HOST_PREFIX, PLATFORM_HOST_PREFIX } from "@/lib/proxy/zones";
import type { TenantPlan, TenantStatus } from "@/lib/generated/prisma/enums";

/**
 * SEUL module du dépôt autorisé à requêter Tenant **sans filtre `tenantId`**
 * (spec §7). Partout ailleurs, l'absence de ce filtre est une fuite de données
 * inter-boutiques. Chaque fonction commence donc par `requireSuperAdmin()` :
 * le « sans filtre » reste un choix délibéré, concentré et relisable.
 * (`updateTenantModules` dans `actions.ts` fait bien une lecture Tenant
 * directe, mais filtrée par `id` — donc gardée par construction — et ne
 * relève pas de cette claim, spécifique aux requêtes non filtrées.)
 */

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  enabledModules: string[];
  domains: string[];
  createdAt: Date;
  ownerName: string | null;
  productCount: number;
  orderCount: number;
}

export interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  font: string;
  logoText: string;
  whatsappPhone: string;
  domains: string[];
  status: TenantStatus;
  plan: TenantPlan;
  enabledModules: string[];
  createdAt: Date;
  owner: { id: string; name: string; email: string } | null;
}

export async function listTenants(): Promise<TenantListItem[]> {
  await requireSuperAdmin();
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { products: true, orders: true } },
      profiles: { where: { role: "owner" }, orderBy: { createdAt: "asc" }, select: { name: true }, take: 1 },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    plan: row.plan,
    enabledModules: row.enabledModules,
    domains: row.domains,
    createdAt: row.createdAt,
    ownerName: row.profiles[0]?.name ?? null,
    productCount: row._count.products,
    orderCount: row._count.orders,
  }));
}

export async function getTenantBySlug(slug: string): Promise<TenantDetail | null> {
  await requireSuperAdmin();
  const row = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      profiles: {
        where: { role: "owner" },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true },
        take: 1,
      },
    },
  });
  if (!row) return null;
  const owner = row.profiles[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    font: row.font,
    logoText: row.logoText,
    whatsappPhone: row.whatsappPhone ?? "",
    domains: row.domains,
    status: row.status,
    plan: row.plan,
    enabledModules: row.enabledModules,
    createdAt: row.createdAt,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email ?? "" } : null,
  };
}

/** Forme nue d'un domaine : retire un préfixe `admin.`/`platform.` s'il y en a un. */
function bareForm(domain: string): string {
  if (domain.startsWith(ADMIN_HOST_PREFIX)) return domain.slice(ADMIN_HOST_PREFIX.length);
  if (domain.startsWith(PLATFORM_HOST_PREFIX)) return domain.slice(PLATFORM_HOST_PREFIX.length);
  return domain;
}

/**
 * Unicité inter-boutiques de `domains` (spec §11). `domains` est un tableau :
 * aucune contrainte base ne peut l'assurer, c'est donc une vérification
 * applicative — d'où l'importance de passer par ce point unique.
 *
 * `resolveTenantFromHost` (lib/tenant/registry.ts) fait correspondre `admin.`/
 * `platform.` + un domaine nu au tenant qui détient l'entrée NUE (repli après
 * échec de la correspondance exacte) : une seule entrée nue couvre les trois
 * surfaces. Se limiter à la correspondance exacte ici laisserait un autre
 * tenant enregistrer littéralement `admin.<domaine nu de X>` sans conflit
 * détecté, alors que ce host cesserait aussitôt de résoudre vers X — un
 * détournement silencieux du sous-domaine admin/plateforme de X. On vérifie
 * donc les trois formes (nue, `admin.`, `platform.`) dérivées de la forme
 * canonique du domaine candidat, qui couvrent aussi la correspondance exacte
 * d'origine (le domaine candidat est toujours égal à l'une des trois).
 */
export async function findTenantByDomain(
  domain: string,
  exceptTenantId?: string
): Promise<{ id: string; slug: string; name: string } | null> {
  await requireSuperAdmin();
  const bare = bareForm(domain);
  const candidates = [bare, `${ADMIN_HOST_PREFIX}${bare}`, `${PLATFORM_HOST_PREFIX}${bare}`];
  const row = await prisma.tenant.findFirst({
    where: {
      OR: candidates.map((candidate) => ({ domains: { has: candidate } })),
      ...(exceptTenantId ? { NOT: { id: exceptTenantId } } : {}),
    },
    select: { id: true, slug: true, name: true },
  });
  return row;
}

export async function tenantSlugExists(slug: string, exceptTenantId?: string): Promise<boolean> {
  await requireSuperAdmin();
  const row = await prisma.tenant.findFirst({
    where: { slug, ...(exceptTenantId ? { NOT: { id: exceptTenantId } } : {}) },
    select: { id: true },
  });
  return row !== null;
}
