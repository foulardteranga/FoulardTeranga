"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { fmt, money } from "@/lib/format";
import type { FinanceSnapshot } from "@/lib/data/finance.server";

/** Teinte de la barre de ventilation par mode de paiement (repli neutre pour un mode inconnu). */
const MODE_FILL: Record<string, string> = {
  espece: colors.success,
  orange_money: colors.accent,
  wave: colors.primary,
  moov_money: colors.gold,
  mtn_momo: colors.accent,
  mm: colors.primary,
  mixte: colors.gold,
  unpaid: colors.muted,
};

export function FinanceScreen({ snapshot }: { snapshot: FinanceSnapshot }) {
  const kpis = [
    { label: "CA du jour", value: fmt(snapshot.today.revenue), unit: "FCFA" },
    { label: "Transactions", value: String(snapshot.today.transactions), unit: "" },
    { label: "Panier moyen", value: fmt(snapshot.today.averageBasket), unit: "FCFA" },
    { label: "Remises accordées", value: fmt(snapshot.today.discounts), unit: "FCFA" },
  ];

  return (
    <div className="ft-pad" style={{ maxWidth: 1200 }}>
      <div className="ft-grid-4" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 24, letterSpacing: "-.01em" }}>
              {k.value}{" "}
              {k.unit && <span style={{ fontFamily: fonts.ui, fontSize: 12, fontWeight: 600, color: colors.muted }}>{k.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="ft-fin-split">
        {/* journal */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Journal des transactions</span>
            <span style={{ fontSize: 12.5, color: colors.muted }}>30 derniers jours</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ background: colors.ivory, color: colors.muted, textAlign: "left" }}>
                  <th style={th("16px")}>Réf.</th>
                  <th style={th("10px")}>Date</th>
                  <th style={th("10px")}>Canal</th>
                  <th style={th("10px")}>Mode</th>
                  <th style={{ ...th("16px"), textAlign: "right" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.journal.map((t, i) => (
                  <tr key={t.ref} style={{ borderTop: "1px solid #EFEAE0", background: i % 2 ? colors.rowAlt : "#fff" }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600 }}>{t.ref}</td>
                    <td style={{ padding: 10, color: colors.muted }}>{t.date}</td>
                    <td style={{ padding: 10, color: colors.muted }}>{t.channel}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 11.5px ${fonts.ui}`, padding: "3px 8px", borderRadius: 999, background: colors.bgInfo, color: colors.primary }}>
                        {t.paymentLabel}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: colors.ink }}>{money(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshot.journal.length === 0 && (
              <p style={{ padding: "18px 16px", fontSize: 13, color: colors.muted, margin: 0 }}>
                Aucune vente sur les 30 derniers jours.
              </p>
            )}
          </div>
        </div>

        {/* breakdown */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 16 }}>Encaissements par mode</div>
          {snapshot.breakdown.length === 0 && (
            <p style={{ fontSize: 13, color: colors.muted, margin: "0 0 16px" }}>Aucun encaissement sur la période.</p>
          )}
          {snapshot.breakdown.map((p) => (
            <div key={p.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{money(p.amount)}</span>
              </div>
              <div style={{ height: 9, background: "#F1ECE2", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p.pct}%`, background: MODE_FILL[p.key] ?? colors.primary, borderRadius: 999 }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${colors.borderSoft}`, marginTop: 6, paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total encaissé</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22, color: colors.primary }}>{money(snapshot.breakdownTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function th(px: string): React.CSSProperties {
  return {
    padding: `10px ${px}`,
    font: `600 11.5px ${fonts.ui}`,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };
}
