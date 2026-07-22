import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { defaultPage, parsePageContent, type StorefrontPageContent } from "@/lib/storefront/pageContent";

const SLUG = "home";

/** Contenu publié de la vitrine (rendu public). Défaut si aucune ligne. */
export async function getPublishedPage(): Promise<StorefrontPageContent> {
  const tenant = await getCurrentTenant();
  const row = await prisma.storefrontPage.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
  });
  return row ? parsePageContent(row.published) : defaultPage();
}

/** Contenu brouillon (éditeur back-office). Défaut si aucune ligne. */
export async function getDraftPage(): Promise<StorefrontPageContent> {
  const tenant = await getCurrentTenant();
  const row = await prisma.storefrontPage.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
  });
  return row ? parsePageContent(row.draft) : defaultPage();
}
