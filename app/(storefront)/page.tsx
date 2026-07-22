import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { getPublishedPage } from "@/lib/data/storefrontPage.server";
import { HomeShell } from "@/components/storefront/HomeShell";

export default async function StorefrontHomePage() {
  const [products, tenant, page] = await Promise.all([
    getCatalog(),
    getTenantSettings(),
    getPublishedPage(),
  ]);
  return <HomeShell page={page} products={products} whatsappPhone={tenant.phone} />;
}
