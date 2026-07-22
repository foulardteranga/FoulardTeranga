import { getTenantSettings } from "@/lib/data/tenant.server";
import { BoutiqueScreen } from "@/components/dashboard/screens/BoutiqueScreen";

export default async function BoutiquePage() {
  const tenant = await getTenantSettings();
  return <BoutiqueScreen tenant={tenant} />;
}
