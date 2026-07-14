import { getCatalog } from "@/lib/data/catalog.server";
import { ThemeScreen } from "@/components/dashboard/screens/ThemeScreen";

export default async function PersonnalisationPage() {
  const products = await getCatalog();
  return <ThemeScreen products={products} />;
}
