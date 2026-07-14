import { getCatalog } from "@/lib/data/catalog";
import { DashboardScreen } from "@/components/dashboard/screens/DashboardScreen";

export default async function DashboardPage() {
  const products = await getCatalog();
  return <DashboardScreen products={products} />;
}
