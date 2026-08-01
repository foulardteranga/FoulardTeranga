import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { PLAN_LABELS } from "@/lib/platform/plans";
import { Icon, ICONS } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/platform/StatusBadge";
import type { TenantListItem } from "@/lib/platform/queries";

export function TenantListScreen({
  tenants,
  includeArchived,
  basePath = "",
}: {
  tenants: TenantListItem[];
  includeArchived: boolean;
  basePath?: string;
}) {
  return (
    <div>
      <style>{`
        .ft-parc-table { width: 100%; border-collapse: collapse; }
        .ft-parc-table th, .ft-parc-table td { text-align: left; padding: 12px 14px; font-size: 14px; }
        .ft-parc-table thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: ${colors.muted}; }
        .ft-parc-table tbody tr + tr { border-top: 1px solid ${colors.faintLine}; }
        .ft-parc-table tbody tr:hover { background: ${colors.rowAlt}; }
        .ft-parc-cards { display: none; }
        @media (max-width: 820px) {
          .ft-parc-table-wrap { display: none; }
          .ft-parc-cards { display: grid; gap: 12px; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: 0 }}>Parc de boutiques</h1>
          {tenants.length > 0 && (
            <p style={{ color: colors.muted, fontSize: 14, margin: "4px 0 0" }}>
              {`${tenants.length} boutique${tenants.length > 1 ? "s" : ""} administrée${tenants.length > 1 ? "s" : ""}.`}
            </p>
          )}
        </div>
        <Link
          href={`${basePath}/boutiques/nouvelle`}
          className="ft-platform-btn ft-platform-btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: colors.primary,
            color: "#fff",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <Icon path={ICONS.plus} size={16} />
          Nouvelle boutique
        </Link>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Link
          href={includeArchived ? `${basePath}/boutiques` : `${basePath}/boutiques?archivees=1`}
          className="ft-platform-link"
          style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}
        >
          {includeArchived ? "Masquer les boutiques archivées" : "Afficher les boutiques archivées"}
        </Link>
      </div>

      {tenants.length === 0 ? (
        <div
          style={{
            background: colors.surface,
            border: adminBorder,
            borderRadius: 16,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: colors.bgInfo,
              color: colors.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Icon path={ICONS.dash} size={24} />
          </div>
          <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
            Aucune boutique dans le parc pour le moment — utilisez « Nouvelle boutique » ci-dessus pour créer la première.
          </p>
        </div>
      ) : (
        <>
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
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <Link href={`${basePath}/boutiques/${tenant.slug}`} className="ft-platform-link" style={{ color: colors.primary, fontWeight: 600, textDecoration: "none" }}>
                        {tenant.name}
                      </Link>
                      <div style={{ color: colors.muted, fontSize: 12 }}>{tenant.slug}</div>
                    </td>
                    <td>{tenant.ownerName ?? <span style={{ color: colors.muted }}>—</span>}</td>
                    <td>
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td>{PLAN_LABELS[tenant.plan]}</td>
                    <td>{tenant.enabledModules.length}</td>
                    <td>{tenant.productCount}</td>
                    <td>{tenant.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ft-parc-cards">
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`${basePath}/boutiques/${tenant.slug}`}
                className="ft-platform-card-link"
                style={{ background: colors.surface, border: adminBorder, borderRadius: 14, padding: 16, textDecoration: "none", color: colors.ink, display: "block" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{tenant.name}</div>
                    <div style={{ color: colors.muted, fontSize: 12 }}>{tenant.slug}</div>
                  </div>
                  <StatusBadge status={tenant.status} />
                </div>
                <div style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>
                  {PLAN_LABELS[tenant.plan]} · {tenant.productCount} produits · {tenant.orderCount} commandes
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
