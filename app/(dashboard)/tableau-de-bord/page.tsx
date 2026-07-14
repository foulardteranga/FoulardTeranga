import { getCatalog } from "@/lib/data/catalog.server";
import { getOrders } from "@/lib/data/orders.server";
import { DashboardScreen } from "@/components/dashboard/screens/DashboardScreen";

export default async function DashboardPage() {
  const [products, orders] = await Promise.all([getCatalog(), getOrders()]);
  return <DashboardScreen products={products} orders={orders} />;
}
