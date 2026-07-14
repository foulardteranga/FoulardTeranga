import { getCatalog } from "@/lib/data/catalog";
import { InventoryScreen } from "@/components/dashboard/screens/InventoryScreen";

export default async function InventoryPage() {
  const products = await getCatalog();
  return <InventoryScreen products={products} />;
}
