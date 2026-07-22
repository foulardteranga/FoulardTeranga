import { getPromoCodes } from "@/lib/data/promos.server";
import { getMarketingStats } from "@/lib/data/marketing.server";
import { MarketingScreen } from "@/components/dashboard/screens/MarketingScreen";

export default async function MarketingPage() {
  const [promos, stats] = await Promise.all([getPromoCodes(), getMarketingStats()]);
  return <MarketingScreen promos={promos} stats={stats} />;
}
