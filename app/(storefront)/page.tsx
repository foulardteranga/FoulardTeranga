import { getCatalog } from "@/lib/data/catalog.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { getSession } from "@/lib/auth";
import { HomeShell } from "@/components/storefront/HomeShell";

export default async function StorefrontHomePage() {
  const [products, tenant, session] = await Promise.all([getCatalog(), getTenantSettings(), getSession()]);
  const canEditBlocks = session?.role === "owner" || session?.role === "staff";
  return <HomeShell products={products} whatsappPhone={tenant.phone} canEditBlocks={canEditBlocks} />;
}
