import { getCatalog } from "@/lib/data/catalog.server";
import { MarketingScreen } from "@/components/dashboard/screens/MarketingScreen";

export default async function MarketingPage() {
  const products = await getCatalog();
  return <MarketingScreen products={products} />;
}
