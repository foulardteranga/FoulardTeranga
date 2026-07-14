import { getOrderByRef } from "@/lib/data/orders.server";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const order = ref ? await getOrderByRef(ref) : null;
  return <ConfirmView order={order} />;
}
