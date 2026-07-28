import { prisma } from "@/lib/db/client";
import { requireSuperAdmin } from "./guard";
import type { TenantPlan, TenantStatus } from "@/lib/generated/prisma/enums";

/**
 * SEUL module du dépôt autorisé à requêter sans filtre `tenantId` (spec §7).
 * Partout ailleurs, l'absence de ce filtre est une fuite de données inter-
 * boutiques. Chaque fonction commence donc par `requireSuperAdmin()` : le
 * « sans filtre » reste un choix délibéré, concentré et relisable.
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
      profiles: { where: { role: "owner" }, select: { name: true }, take: 1 },
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
      profiles: { where: { role: "owner" }, select: { id: true, name: true, email: true }, take: 1 },
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

/**
 * Unicité inter-boutiques de `domains` (spec §11). `domains` est un tableau :
 * aucune contrainte base ne peut l'assurer, c'est donc une vérification
 * applicative — d'où l'importance de passer par ce point unique.
 */
export async function findTenantByDomain(
  domain: string,
  exceptTenantId?: string
): Promise<{ id: string; slug: string; name: string } | null> {
  await requireSuperAdmin();
  const row = await prisma.tenant.findFirst({
    where: {
      domains: { has: domain },
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
