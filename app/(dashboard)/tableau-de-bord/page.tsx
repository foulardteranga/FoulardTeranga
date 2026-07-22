import { getCatalog } from "@/lib/data/catalog.server";
import { getOrders } from "@/lib/data/orders.server";
import { getDashboardStats } from "@/lib/data/dashboard.server";
import { DashboardScreen } from "@/components/dashboard/screens/DashboardScreen";

export default async function DashboardPage() {
  const [products, orders, stats] = await Promise.all([getCatalog(), getOrders(), getDashboardStats()]);
  return <DashboardScreen products={products} orders={orders} stats={stats} />;
}
