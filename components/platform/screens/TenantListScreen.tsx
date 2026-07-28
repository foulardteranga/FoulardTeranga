import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { PLAN_LABELS } from "@/lib/platform/plans";
import type { TenantListItem } from "@/lib/platform/queries";

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: colors.bgSuccess, fg: colors.fgSuccess, label: "Active" },
  suspended: { bg: colors.bgWarning, fg: colors.fgWarning, label: "Suspendue" },
  archived: { bg: colors.bgInfo, fg: colors.fgInfo, label: "Archivée" },
};

export function TenantListScreen({ tenants }: { tenants: TenantListItem[] }) {
  return (
    <div>
      <style>{`
        .ft-parc-table { width: 100%; border-collapse: collapse; }
        .ft-parc-table th, .ft-parc-table td { text-align: left; padding: 12px 14px; font-size: 14px; }
        .ft-parc-table thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: ${colors.muted}; }
        .ft-parc-table tbody tr + tr { border-top: 1px solid ${colors.faintLine}; }
        .ft-parc-cards { display: none; }
        @media (max-width: 820px) {
          .ft-parc-table-wrap { display: none; }
          .ft-parc-cards { display: grid; gap: 12px; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: 0 }}>Parc de boutiques</h1>
          <p style={{ color: colors.muted, fontSize: 14, margin: "4px 0 0" }}>
            {tenants.length === 0
              ? "Aucune boutique pour le moment."
              : `${tenants.length} boutique${tenants.length > 1 ? "s" : ""} administrée${tenants.length > 1 ? "s" : ""}.`}
          </p>
        </div>
        <Link
          href="/boutiques/nouvelle"
          style={{
            background: colors.primary,
            color: "#fff",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Nouvelle boutique
        </Link>
      </div>

      <div className="ft-parc-table-wrap" style={{ background: colors.surface, border: adminBorder, borderRadius: 16, overflowX: "auto" }}>
        <table className="ft-parc-table">
          <thead>
            <tr>
              <th>Boutique</th>
              <th>Gérante</th>
              <th>État</th>
              <th>Palier</th>
              <th>Modules</th>
              <th>Produits</th>
              <th>Commandes</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => {
              const status = STATUS_STYLES[tenant.status] ?? STATUS_STYLES.active;
              return (
                <tr key={tenant.id}>
                  <td>
                    <Link href={`/boutiques/${tenant.slug}`} style={{ color: colors.primary, fontWeight: 600, textDecoration: "none" }}>
                      {tenant.name}
                    </Link>
                    <div style={{ color: colors.muted, fontSize: 12 }}>{tenant.slug}</div>
                  </td>
                  <td>{tenant.ownerName ?? <span style={{ color: colors.muted }}>—</span>}</td>
                  <td>
                    <span style={{ background: status.bg, color: status.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                      {status.label}
                    </span>
                  </td>
                  <td>{PLAN_LABELS[tenant.plan]}</td>
                  <td>{tenant.enabledModules.length}</td>
                  <td>{tenant.productCount}</td>
                  <td>{tenant.orderCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ft-parc-cards">
        {tenants.map((tenant) => {
          const status = STATUS_STYLES[tenant.status] ?? STATUS_STYLES.active;
          return (
            <Link
              key={tenant.id}
              href={`/boutiques/${tenant.slug}`}
              style={{ background: colors.surface, border: adminBorder, borderRadius: 14, padding: 16, textDecoration: "none", color: colors.ink, display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{tenant.name}</div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>{tenant.slug}</div>
                </div>
                <span style={{ background: status.bg, color: status.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                  {status.label}
                </span>
              </div>
              <div style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>
                {PLAN_LABELS[tenant.plan]} · {tenant.productCount} produits · {tenant.orderCount} commandes
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
