import { getCatalog } from "@/lib/data/catalog.server";
import { getPromoCodes } from "@/lib/data/promos.server";
import { MarketingScreen } from "@/components/dashboard/screens/MarketingScreen";

export default async function MarketingPage() {
  const [products, promos] = await Promise.all([getCatalog(), getPromoCodes()]);
  return <MarketingScreen products={products} promos={promos} />;
}
