import { listTenants } from "@/lib/platform/queries";
import { TenantListScreen } from "@/components/platform/screens/TenantListScreen";

export default async function BoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ archivees?: string }>;
}) {
  const { archivees } = await searchParams;
  const includeArchived = archivees === "1";
  const tenants = await listTenants({ includeArchived });
  return <TenantListScreen tenants={tenants} includeArchived={includeArchived} />;
}
