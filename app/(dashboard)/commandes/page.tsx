import { OrdersScreen } from "@/components/dashboard/screens/OrdersScreen";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ sel?: string }>;
}) {
  const { sel } = await searchParams;
  return <OrdersScreen initialSel={sel} />;
}
