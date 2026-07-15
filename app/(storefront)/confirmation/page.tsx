import { getOrderByRef } from "@/lib/data/orders.server";
import { getTenantSettings } from "@/lib/data/tenant.server";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const [order, tenant] = await Promise.all([
    ref ? getOrderByRef(ref) : Promise.resolve(null),
    getTenantSettings(),
  ]);
  return <ConfirmView order={order} whatsappPhone={tenant.phone} />;
}
