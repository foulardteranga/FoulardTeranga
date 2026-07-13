"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { clients, customerHistory } from "@/lib/data/clients";

const SEGMENTS = ["Toutes", "VIP", "Fidèle", "Nouvelle"] as const;

export function CustomersScreen() {
  const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>("Toutes");
  const [selId, setSelId] = useState<string>("c1");

  const list = clients.filter(
    (c) => seg === "Toutes" || c.seg === seg || (seg === "VIP" && c.vip)
  );
  const cd = clients.find((c) => c.id === selId) ?? clients[0];

  return (
    <div className="ft-pad">
      <div className="ft-cust-cols">
        {/* list */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", height: 38, padding: "0 12px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, gap: 8 }}>
              <Icon path={ICONS.search} size={16} stroke={colors.muted} />
              <input placeholder="Rechercher une cliente…" style={{ flex: 1, border: "none", outline: "none", font: `400 13px ${fonts.ui}`, background: "transparent" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, padding: "11px 16px", borderBottom: "1px solid #F1ECE2", flexWrap: "wrap" }}>
            {SEGMENTS.map((g) => {
              const on = seg === g;
              return (
                <button
                  key={g}
                  onClick={() => setSeg(g)}
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 999,
                    font: `600 12px ${fonts.ui}`,
                    cursor: "pointer",
                    border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                    background: on ? colors.primary : "#fff",
                    color: on ? "#fff" : colors.muted,
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {list.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelId(c.id)}
                className="ft-hover-surface"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: `1px solid ${colors.faintLine}`,
                  cursor: "pointer",
                  background: selId === c.id ? "#F7F3EC" : "#fff",
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: c.vip ? colors.ink : "#EEF0F7",
                    color: c.vip ? colors.gold : colors.primary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: 14,
                    flex: "none",
                  }}
                >
                  {c.initials}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</span>
                    {c.vip && <VipBadge small />}
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    {c.orders} commandes · {c.spent}
                  </div>
                </div>
                <span style={{ font: `600 12.5px ${fonts.ui}`, color: colors.gold }}>★ {c.points}</span>
              </div>
            ))}
          </div>
        </div>

        {/* detail + loyalty */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: cd.vip ? colors.ink : "#EEF0F7",
                  color: cd.vip ? colors.gold : colors.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 19,
                  flex: "none",
                }}
              >
                {cd.initials}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20 }}>{cd.name}</span>
                  {cd.vip && <VipBadge />}
                </div>
                <div style={{ fontSize: 12.5, color: colors.muted }}>
                  {cd.phone} · {cd.place}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <StatBox label="Points" value={cd.points} color={colors.gold} />
              <StatBox label="Dépensé" value={cd.spent} />
              <StatBox label="Commandes" value={cd.orders} />
            </div>
            <div style={sectionLabel}>Historique d&apos;achats</div>
            {customerHistory.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${colors.faintLine}`, fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{h.id}</span> <span style={{ color: colors.muted }}>· {h.date}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{h.total}</span>
              </div>
            ))}
          </div>

          {/* loyalty config */}
          <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Programme de fidélité</div>
            <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>Règles de points et promotions ciblées.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={fieldLabel}>1 point par tranche de</label>
                <div style={suffixField}>
                  <input defaultValue="1 000" style={bareInput} />
                  <span style={{ color: colors.muted, fontSize: 13 }}>FCFA</span>
                </div>
              </div>
              <div>
                <label style={fieldLabel}>Seuil VIP</label>
                <div style={suffixField}>
                  <input defaultValue="150" style={bareInput} />
                  <span style={{ color: colors.muted, fontSize: 13 }}>points</span>
                </div>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14, cursor: "pointer" }}>
              <span style={{ width: 44, height: 26, borderRadius: 999, background: colors.success, position: "relative", flex: "none" }}>
                <span style={{ position: "absolute", top: 3, left: 21, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
              </span>
              <span style={{ fontSize: 13.5 }}>Promo d&apos;anniversaire automatique (−15%)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function VipBadge({ small }: { small?: boolean }) {
  return (
    <span
      style={{
        font: `600 ${small ? 10 : 10.5}px ${fonts.ui}`,
        background: colors.ink,
        color: colors.gold,
        padding: small ? "1px 6px" : "2px 8px",
        borderRadius: 999,
        border: `1px solid ${colors.gold}`,
      }}
    >
      ★ VIP
    </span>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 11.5, color: colors.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 20, color: color ?? colors.ink }}>{value}</div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  font: `600 11px ${fonts.ui}`,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: colors.muted,
  marginBottom: 10,
};
const fieldLabel: React.CSSProperties = { display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 };
const suffixField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 42,
  padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  background: "#fff",
};
const bareInput: React.CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", font: `400 14px ${fonts.ui}` };
