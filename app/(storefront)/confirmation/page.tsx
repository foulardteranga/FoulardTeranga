import { getOrderByTrackingToken, getOrderStatusHistory } from "@/lib/data/orders.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const [order, tenant] = await Promise.all([
    token ? getOrderByTrackingToken(token) : Promise.resolve(null),
    getTenantSettings(),
  ]);
  const events = order ? await getOrderStatusHistory(order.id) : [];
  return <ConfirmView order={order} events={events} whatsappPhone={tenant.phone} />;
}
