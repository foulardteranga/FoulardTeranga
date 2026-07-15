import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { ThemeScreen } from "@/components/dashboard/screens/ThemeScreen";

export default async function PersonnalisationPage() {
  const [products, tenant] = await Promise.all([getCatalog(), getTenantSettings()]);
  return <ThemeScreen products={products} tenant={tenant} />;
}
