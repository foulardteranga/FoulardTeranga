import { listTenants } from "@/lib/platform/queries";
import { TenantListScreen } from "@/components/platform/screens/TenantListScreen";

export default async function BoutiquesPage() {
  const tenants = await listTenants();
  return <TenantListScreen tenants={tenants} />;
}
