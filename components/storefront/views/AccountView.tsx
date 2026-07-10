import { fonts, colors } from "@/lib/theme/tokens";
import { clients, customerHistory } from "@/lib/data/clients";
import { initials } from "@/lib/format";

const account = clients[0];

export function AccountView() {
  return (
    <div className="ft-store-page" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <span style={{ width: 60, height: 60, flex: "none", borderRadius: 999, background: colors.primary, display: "flex", alignItems: "center", justifyContent: "center", font: `600 22px ${fonts.ui}`, color: "#fff" }}>
          {initials(account.name)}
        </span>
        <div>
          <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
            Bonjour, {account.name.split(" ")[0]}
          </h1>
          <div style={{ fontSize: 14, color: colors.muted }}>{account.phone}</div>
        </div>
      </div>

      <div className="ft-store-account-grid" style={{ display: "grid", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#1E1B18", borderRadius: 16, padding: "22px 24px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "#2c2822", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={colors.gold} stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
            </span>
            <span style={{ font: `600 13px ${fonts.ui}`, color: "#C9BEB0" }}>Points Teranga</span>
            {account.vip && (
              <span style={{ marginLeft: "auto", font: `700 11px ${fonts.ui}`, padding: "3px 9px", borderRadius: 999, background: "#2c2822", color: colors.gold, border: `1px solid ${colors.gold}` }}>
                Palier Or
              </span>
            )}
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 38, lineHeight: 1 }}>
            {account.points} <span style={{ fontSize: 16, color: "#C9BEB0" }}>pts</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#2c2822", margin: "14px 0 8px", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.min(100, (account.points / 300) * 100)}%`, background: colors.gold }} />
          </div>
          <div style={{ fontSize: 12.5, color: "#C9BEB0" }}>
            {account.points >= 300 ? "Bon de 5% disponible !" : `Plus que ${300 - account.points} points avant votre bon de 5%.`}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ font: `600 14px ${fonts.ui}`, marginBottom: 16 }}>Mes coordonnées</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
            <Row label="Téléphone" value={account.phone} />
            <Row label="Livraison" value={account.place} />
            <Row label="Segment" value={account.seg} valueColor={colors.success} />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "22px 24px" }}>
        <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 16 }}>Historique des commandes</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {customerHistory.map((o, i) => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid #EFEAE0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `600 14px ${fonts.ui}` }}>{o.id}</div>
                <div style={{ fontSize: 12.5, color: colors.muted }}>{o.date}</div>
              </div>
              <div style={{ font: `700 15px ${fonts.ui}`, color: colors.primary }}>{o.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>{value}</span>
    </div>
  );
}
