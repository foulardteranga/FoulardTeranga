import { getCatalog } from "@/lib/data/catalog.server";
import { PosScreen } from "@/components/dashboard/screens/PosScreen";

export default async function PosPage() {
  const products = await getCatalog();
  return <PosScreen products={products} />;
}
