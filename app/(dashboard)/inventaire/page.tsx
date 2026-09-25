import { getCatalog } from "@/lib/data/catalog.server";
import { InventoryScreen } from "@/components/dashboard/screens/InventoryScreen";

export default async function InventoryPage() {
  const products = await getCatalog(undefined, { includeArchived: true });
  return <InventoryScreen products={products} />;
}
