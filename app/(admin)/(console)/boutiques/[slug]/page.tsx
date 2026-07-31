import { notFound } from "next/navigation";
import { getTenantBySlug, getTenantTeam } from "@/lib/platform/queries";
import { getTenantHealth } from "@/lib/platform/health";
import { TenantDetailScreen, type TenantTab } from "@/components/platform/screens/TenantDetailScreen";
import { TenantOverviewTab } from "@/components/platform/screens/TenantOverviewTab";
import { TenantIdentityForm } from "@/components/platform/screens/TenantIdentityForm";
import { TenantModulesForm } from "@/components/platform/screens/TenantModulesForm";
import { TenantTeamTab } from "@/components/platform/screens/TenantTeamTab";
import { TenantDangerTab } from "@/components/platform/screens/TenantDangerTab";

const TABS = ["apercu", "modules", "equipe", "identite", "danger"] as const;

function resolveTab(raw: string | undefined): TenantTab {
  return (TABS as readonly string[]).includes(raw ?? "") ? (raw as TenantTab) : "apercu";
}

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

  const tab = resolveTab(onglet);
  const health = tab === "apercu" ? await getTenantHealth(tenant.id, tenant.owner?.id ?? null) : null;
  const team = tab === "equipe" ? await getTenantTeam(tenant.id) : null;

  return (
    <TenantDetailScreen tenant={tenant} tab={tab}>
      {tab === "apercu" && health && <TenantOverviewTab tenant={tenant} health={health} />}
      {tab === "modules" && <TenantModulesForm tenant={tenant} />}
      {tab === "equipe" && team && <TenantTeamTab tenant={tenant} team={team} />}
      {tab === "identite" && <TenantIdentityForm tenant={tenant} />}
      {tab === "danger" && <TenantDangerTab tenant={tenant} />}
    </TenantDetailScreen>
  );
}
