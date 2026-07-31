import { requireActiveStorefrontTenant } from "@/lib/tenant";
import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { getPublishedPage } from "@/lib/data/storefrontPage.server";
import { HomeShell } from "@/components/storefront/HomeShell";

export default async function StorefrontHomePage() {
  // Le layout rend déjà un 404 (hôte inconnu/archivée) ou StoreUnavailable
  // (suspendue), mais Next rend layout et page en parallèle : sans ce garde,
  // ce segment appelle getCurrentTenant() (via
  // getCatalog()/getTenantSettings()/getPublishedPage()) et lève une exception
  // non capturée dans les logs, en plus de la réponse déjà décidée par le layout.
  await requireActiveStorefrontTenant();

  const [products, tenant, page] = await Promise.all([
    getCatalog(),
    getTenantSettings(),
    getPublishedPage(),
  ]);
  return <HomeShell page={page} products={products} whatsappPhone={tenant.phone} />;
}
