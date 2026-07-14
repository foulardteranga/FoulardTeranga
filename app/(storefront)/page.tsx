import { getCatalog } from "@/lib/data/catalog.server";
import { HomeShell } from "@/components/storefront/HomeShell";

export default async function StorefrontHomePage() {
  const products = await getCatalog();
  return <HomeShell products={products} />;
}
