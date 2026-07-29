import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getOrderByTrackingToken, getOrderStatusHistory } from "@/lib/data/orders.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  // Le layout rend déjà un 404 sur hôte inconnu, mais Next rend layout et page
  // en parallèle : sans ce garde, ce segment appelle getCurrentTenant() (via
  // getTenantSettings()) et lève une exception non capturée dans les logs, en
  // plus du 404 correct.
  if (!(await getCurrentTenantOrNull())) notFound();

  const { token } = await searchParams;
  const [order, tenant] = await Promise.all([
    token ? getOrderByTrackingToken(token) : Promise.resolve(null),
    getTenantSettings(),
  ]);
  const events = order ? await getOrderStatusHistory(order.id) : [];
  return <ConfirmView order={order} events={events} whatsappPhone={tenant.phone} />;
}
