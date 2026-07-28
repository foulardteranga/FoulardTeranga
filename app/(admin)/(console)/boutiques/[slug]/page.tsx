import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/platform/queries";
import { TenantDetailScreen, type TenantTab } from "@/components/platform/screens/TenantDetailScreen";
import { TenantIdentityForm } from "@/components/platform/screens/TenantIdentityForm";
import { TenantModulesForm } from "@/components/platform/screens/TenantModulesForm";

export default async function BoutiqueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const [{ slug }, { onglet }] = await Promise.all([params, searchParams]);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const tab: TenantTab = onglet === "modules" ? "modules" : "identite";
  return (
    <TenantDetailScreen tenant={tenant} tab={tab}>
      {tab === "modules" ? <TenantModulesForm tenant={tenant} /> : <TenantIdentityForm tenant={tenant} />}
    </TenantDetailScreen>
  );
}
