import { headers } from "next/headers";
import { listTenants } from "@/lib/platform/queries";
import { TenantListScreen } from "@/components/platform/screens/TenantListScreen";
import { platformPath } from "@/lib/proxy/zones";

export default async function BoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ archivees?: string }>;
}) {
  const { archivees } = await searchParams;
  const includeArchived = archivees === "1";
  const hostname = (await headers()).get("host") ?? "localhost";
  const basePath = platformPath(hostname, "");
  const tenants = await listTenants({ includeArchived });
  return <TenantListScreen tenants={tenants} includeArchived={includeArchived} basePath={basePath} />;
}
