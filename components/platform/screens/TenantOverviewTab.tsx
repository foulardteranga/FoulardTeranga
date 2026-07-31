import { colors, adminBorder } from "@/lib/theme/tokens";
import { StatusBadge } from "@/components/platform/StatusBadge";
import type { TenantDetail } from "@/lib/platform/queries";
import type { TenantHealth } from "@/lib/platform/health";

function formatDate(value: Date | null): string {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(value);
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ background: colors.surface, border: adminBorder, borderRadius: 14, padding: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 600, color: warn ? colors.danger : colors.ink }}>
        {value}
      </p>
    </div>
  );
}

/** Indicateurs de santé et état courant d'une boutique (spec §6, onglet 1 ; spec §10). */
export function TenantOverviewTab({ tenant, health }: { tenant: TenantDetail; health: TenantHealth }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>État</h2>
        <StatusBadge status={tenant.status} />
        {tenant.status === "suspended" && (
          <p style={{ margin: "10px 0 0", fontSize: 14, color: colors.muted }}>
            Suspendue le {formatDate(tenant.suspendedAt)}
            {tenant.suspendedReason ? ` — ${tenant.suspendedReason}` : ""}
          </p>
        )}
        {tenant.status === "archived" && (
          <p style={{ margin: "10px 0 0", fontSize: 14, color: colors.muted }}>
            Archivée le {formatDate(tenant.archivedAt)}
          </p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Diagnostic</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <Metric label="Produits au catalogue" value={String(health.productCount)} />
          <Metric
            label="Produits en rupture"
            value={String(health.outOfStockCount)}
            warn={health.outOfStockCount > 0}
          />
          <Metric label="Commandes sur 30 jours" value={String(health.ordersLast30Days)} />
          <Metric
            label="Vitrine"
            value={health.storefrontPublished ? "Publiée" : "Non publiée"}
            warn={!health.storefrontPublished}
          />
          <Metric label="Dernière connexion de la gérante" value={formatDate(health.ownerLastSignInAt)} />
        </div>
      </section>
    </div>
  );
}
