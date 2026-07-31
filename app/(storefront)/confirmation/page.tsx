import { requireActiveStorefrontTenant } from "@/lib/tenant";
import { getOrderByTrackingToken, getOrderStatusHistory } from "@/lib/data/orders.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  // Le layout rend déjà un 404 (hôte inconnu/archivée) ou StoreUnavailable
  // (suspendue), mais Next rend layout et page en parallèle : sans ce garde,
  // ce segment appelle getCurrentTenant() (via getTenantSettings()) et lève
  // une exception non capturée dans les logs, en plus de la réponse déjà
  // décidée par le layout.
  await requireActiveStorefrontTenant();

  const { token } = await searchParams;
  const [order, tenant] = await Promise.all([
    token ? getOrderByTrackingToken(token) : Promise.resolve(null),
    getTenantSettings(),
  ]);
  const events = order ? await getOrderStatusHistory(order.id) : [];
  return <ConfirmView order={order} events={events} whatsappPhone={tenant.phone} />;
}
