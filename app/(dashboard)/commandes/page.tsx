import { getOrders } from "@/lib/data/orders.server";
import { OrdersScreen } from "@/components/dashboard/screens/OrdersScreen";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ sel?: string }>;
}) {
  const { sel } = await searchParams;
  const orders = await getOrders();
  return <OrdersScreen orders={orders} initialSel={sel} />;
}
