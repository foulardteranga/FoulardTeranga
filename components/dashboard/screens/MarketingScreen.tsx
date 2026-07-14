"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";

const PROMOS = [
  { code: "TERANGA10", desc: "−10% dès 25 000 FCFA", period: "01/07 → 31/07/2026", used: 34 },
  { code: "VIP15", desc: "−15% clientes VIP", period: "Permanent", used: 12 },
];

export function MarketingScreen({ products }: { products: Product[] }) {
  const STARS = [
    { p: products[4], sold: 128 },
    { p: products[0], sold: 96 },
    { p: products[6], sold: 74 },
    { p: products[2], sold: 61 },
  ];
  const DORMANT = [
    { p: products[9], days: 52 },
    { p: products[5], days: 41 },
    { p: products[7], days: 38 },
    { p: products[10], days: 29 },
  ];
  return (
    <div className="ft-pad" style={{ maxWidth: 1200 }}>
      <div className="ft-grid-2" style={{ marginBottom: 14 }}>
        {/* stars */}
        <div style={card}>
          <div style={cardHead}>
            <Icon path={ICONS.star} size={17} stroke={colors.gold} strokeWidth={1.9} />
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Produits stars</span>
          </div>
          {STARS.map(({ p, sold }) => (
            <div key={p.id} style={row}>
              <span style={swatch(p.swatch)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>{sold} vendus</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: colors.fgSuccess }}>
                {money(Math.round((sold * p.price) / 10))}
              </span>
            </div>
          ))}
        </div>

        {/* dormant */}
        <div style={card}>
          <div style={cardHead}>
            <Icon path={ICONS.clock} size={17} stroke={colors.muted} strokeWidth={1.9} />
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Produits dormants</span>
          </div>
          {DORMANT.map(({ p, days }) => (
            <div key={p.id} style={row}>
              <span style={swatch(p.swatch)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>{days} sans vente</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: colors.fgDanger }}>{p.stock} en stock</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ft-grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <MiniKpi label="Taux de rachat" value="42%" delta="+6 pts vs mois dernier" color={colors.primary} />
            <MiniKpi label="Clientes actives" value="318" delta="+28 ce mois" />
          </div>
          <div style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 14 }}>Codes promo actifs</div>
            {PROMOS.map((pr) => (
              <div key={pr.code} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${colors.faintLine}` }}>
                <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: 13, background: colors.ink, color: colors.gold, padding: "5px 10px", borderRadius: 8 }}>
                  {pr.code}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{pr.desc}</div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>{pr.period}</div>
                </div>
                <span style={{ font: `600 11px ${fonts.ui}`, background: colors.bgSuccess, color: colors.fgSuccess, padding: "3px 9px", borderRadius: 999 }}>
                  {pr.used} util.
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* create promo */}
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Créer un code promo</div>
          <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>Remise, période et cible.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={fieldLabel}>Code</label>
              <input
                defaultValue="TERANGA25"
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 13px",
                  border: `1.5px solid ${colors.borderField}`,
                  borderRadius: 10,
                  font: "600 14px ui-monospace,monospace",
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={fieldLabel}>Type</label>
                <Select options={["Pourcentage", "Montant fixe"]} />
              </div>
              <div>
                <label style={fieldLabel}>Valeur</label>
                <div style={suffixField}>
                  <input defaultValue="25" style={bareInput} />
                  <span style={{ color: colors.muted }}>%</span>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={fieldLabel}>Début</label>
                <input defaultValue="10/07/2026" style={textField} />
              </div>
              <div>
                <label style={fieldLabel}>Fin</label>
                <input defaultValue="24/07/2026" style={textField} />
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Cible</label>
              <Select options={["Toutes les clientes", "Clientes VIP", "Clientes dormantes"]} />
            </div>
            <button
              className="ft-primary-btn"
              style={{ height: 48, border: "none", borderRadius: 10, background: colors.accent, color: "#fff", font: `700 15px ${fonts.ui}`, cursor: "pointer", marginTop: 2 }}
            >
              Créer le code promo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, delta, color }: { label: string; value: string; delta: string; color?: string }) {
  return (
    <div style={{ ...card, padding: "18px 20px" }}>
      <div style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: color ?? colors.ink }}>{value}</div>
      <div style={{ font: `600 12px ${fonts.ui}`, color: colors.fgSuccess }}>{delta}</div>
    </div>
  );
}

function Select({ options }: { options: string[] }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        style={{
          width: "100%",
          height: 44,
          padding: "0 36px 0 13px",
          border: `1.5px solid ${colors.borderField}`,
          borderRadius: 10,
          font: `400 14px ${fonts.ui}`,
          appearance: "none",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <Icon path={ICONS.chevronDown} size={16} stroke={colors.muted} strokeWidth={2} />
      </span>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(30,27,24,.08)",
  borderRadius: 14,
  overflow: "hidden",
};
const cardHead: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: `1px solid ${colors.borderSoft}`,
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 18px",
  borderBottom: `1px solid ${colors.faintLine}`,
};
function swatch(bg: string): React.CSSProperties {
  return { width: 34, height: 34, borderRadius: 8, flex: "none", background: bg };
}
const fieldLabel: React.CSSProperties = { display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 };
const suffixField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 44,
  padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
};
const bareInput: React.CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", font: `400 14px ${fonts.ui}` };
const textField: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 13px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14px ${fonts.ui}`,
};
