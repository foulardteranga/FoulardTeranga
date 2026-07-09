"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";

const KPIS = [
  { label: "CA du jour", value: "248 000", unit: "FCFA" },
  { label: "Marge brute", value: "112 400", unit: "FCFA" },
  { label: "Transactions", value: "32", unit: "" },
  { label: "Taux de marge", value: "45", unit: "%" },
];

const MODE_META: Record<string, { bg: string; color: string }> = {
  Espèces: { bg: colors.bgSuccess, color: colors.fgSuccess },
  "Mobile Money": { bg: colors.bgInfo, color: colors.primary },
  Mixte: { bg: colors.bgWarning, color: colors.fgWarning },
};

const TX: Array<[string, string, string, string, number]> = [
  ["TRX-1042", "09:42", "Web", "Mobile Money", 54000],
  ["TRX-1041", "09:18", "Boutique", "Espèces", 27500],
  ["TRX-1040", "08:55", "Web", "Mobile Money", 86000],
  ["TRX-1039", "08:30", "Boutique", "Espèces", 12500],
  ["TRX-1038", "08:02", "Web", "Mixte", 42000],
  ["TRX-1037", "Hier", "Boutique", "Espèces", 18000],
  ["TRX-1036", "Hier", "Web", "Mobile Money", 31000],
  ["TRX-1035", "Hier", "Boutique", "Mixte", 24000],
];

const BREAKDOWN = [
  { label: "Espèces", amount: money(102000), pct: "41%", fill: colors.success },
  { label: "Mobile Money", amount: money(112000), pct: "45%", fill: colors.primary },
  { label: "Mixte", amount: money(34000), pct: "14%", fill: colors.accent },
];

export function FinanceScreen() {
  return (
    <div className="ft-pad" style={{ maxWidth: 1200 }}>
      <div className="ft-grid-4" style={{ marginBottom: 16 }}>
        {KPIS.map((k) => (
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
            <button
              className="ft-hover-surface"
              style={{ height: 36, padding: "0 13px", border: `1.5px solid ${colors.borderField}`, borderRadius: 9, background: "#fff", color: colors.primary, font: `600 12.5px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
            >
              <Icon path={ICONS.upload} size={15} stroke={colors.primary} strokeWidth={1.9} />
              Export
            </button>
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
                {TX.map((t, i) => {
                  const mode = MODE_META[t[3]];
                  return (
                    <tr key={t[0]} style={{ borderTop: "1px solid #EFEAE0", background: i % 2 ? colors.rowAlt : "#fff" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{t[0]}</td>
                      <td style={{ padding: 10, color: colors.muted }}>{t[1]}</td>
                      <td style={{ padding: 10, color: colors.muted }}>{t[2]}</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 11.5px ${fonts.ui}`, padding: "3px 8px", borderRadius: 999, background: mode.bg, color: mode.color }}>
                          {t[3]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: colors.ink }}>{money(t[4])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* breakdown */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 16 }}>Encaissements par mode</div>
          {BREAKDOWN.map((p) => (
            <div key={p.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{p.amount}</span>
              </div>
              <div style={{ height: 9, background: "#F1ECE2", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: p.pct, background: p.fill, borderRadius: 999 }} />
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${colors.borderSoft}`, marginTop: 6, paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total encaissé</span>
              <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22, color: colors.primary }}>{money(248000)}</span>
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
