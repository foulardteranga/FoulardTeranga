import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { PLAN_LABELS } from "@/lib/platform/plans";
import type { TenantDetail } from "@/lib/platform/queries";
import { EnterTenantButton } from "@/components/platform/EnterTenantButton";

export type TenantTab = "apercu" | "modules" | "equipe" | "identite" | "journal" | "danger";

/** Les six onglets du spec §6. Ceux non livrés en phase 2 sont visibles mais inertes. */
const TABS: { id: string; label: string; available: boolean }[] = [
  { id: "apercu", label: "Vue d'ensemble", available: true },
  { id: "modules", label: "Modules", available: true },
  { id: "equipe", label: "Équipe", available: true },
  { id: "identite", label: "Identité", available: true },
  { id: "journal", label: "Journal", available: false },
  { id: "danger", label: "Zone de danger", available: false },
];

export function TenantDetailScreen({
  tenant,
  tab,
  children,
}: {
  tenant: TenantDetail;
  tab: TenantTab;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Link href="/boutiques" className="ft-platform-link" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
        ← Retour au parc
      </Link>

      <header style={{ margin: "10px 0 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: 0 }}>{tenant.name}</h1>
          <p style={{ color: colors.muted, fontSize: 14, margin: "4px 0 0" }}>
            {tenant.slug} · {PLAN_LABELS[tenant.plan]} · {tenant.enabledModules.length} modules ·{" "}
            {tenant.owner ? `Gérante : ${tenant.owner.name}` : "Aucune gérante rattachée"}
          </p>
        </div>
        <EnterTenantButton ownerProfileId={tenant.owner?.id ?? null} tenantStatus={tenant.status} />
      </header>

      <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: adminBorder, marginBottom: 20 }}>
        {TABS.map((item) =>
          item.available ? (
            <Link
              key={item.id}
              href={`/boutiques/${tenant.slug}?onglet=${item.id}`}
              className={tab === item.id ? "ft-platform-tab ft-platform-tab-current" : "ft-platform-tab"}
              style={{
                padding: "9px 14px",
                fontSize: 14,
                fontWeight: tab === item.id ? 600 : 400,
                color: tab === item.id ? colors.primary : colors.muted,
                borderBottom: `2px solid ${tab === item.id ? colors.primary : "transparent"}`,
                textDecoration: "none",
                transition: "color .15s ease-out",
              }}
            >
              {item.label}
            </Link>
          ) : (
            // `aria-disabled` (pas l'attribut natif `disabled`, qui retirerait
            // l'élément du parcours clavier) + un `<button>` plutôt qu'un
            // `<span>` : sans handler, il n'a aucun effet au clic/à l'activation,
            // mais reste focusable et annoncé par un lecteur d'écran, contre un
            // `<span>` qui n'était ni l'un ni l'autre — l'état « pas encore
            // disponible » n'était visible qu'au survol souris (title).
            <button
              key={item.id}
              type="button"
              aria-disabled="true"
              className="ft-platform-tab-inert"
              title="Disponible dans une prochaine phase"
              style={{
                padding: "9px 14px",
                fontSize: 14,
                color: colors.disabled,
                background: "none",
                border: "none",
                borderBottom: "2px solid transparent",
                font: "inherit",
                cursor: "not-allowed",
              }}
            >
              {item.label}
            </button>
          )
        )}
      </nav>

      {children}
    </div>
  );
}
