import { getCatalog } from "@/lib/data/catalog.server";
import { getCustomers } from "@/lib/data/customers.server";
import { PosScreen } from "@/components/dashboard/screens/PosScreen";

export default async function PosPage() {
  const [products, customers] = await Promise.all([getCatalog(), getCustomers()]);
  return <PosScreen products={products} customers={customers} />;
}
