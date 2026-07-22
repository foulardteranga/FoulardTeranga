import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { getDraftPage } from "@/lib/data/storefrontPage.server";
import { VitrineEditor } from "@/components/editor/VitrineEditor";

export default async function VitrineEditorPage() {
  const [products, tenant, page] = await Promise.all([
    getCatalog(),
    getTenantSettings(),
    getDraftPage(),
  ]);
  return <VitrineEditor initialPage={page} products={products} whatsappPhone={tenant.phone} />;
}
