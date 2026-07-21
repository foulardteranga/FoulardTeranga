"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import type { Order, Product } from "@/lib/data/types";
import { money, fmt } from "@/lib/format";
import { initials } from "@/lib/format";
import type { DashboardStats } from "@/lib/data/dashboard.server";

export function DashboardScreen({
  products,
  orders,
  stats,
}: {
  products: Product[];
  orders: Order[];
  stats: DashboardStats;
}) {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [range, setRange] = useState<"7" | "30">("7");

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 750);
    return () => clearTimeout(t);
  }, []);

  const kpis = useMemo(() => {
    const describe = (delta: number | null) => ({
      tone: delta === null ? "neutral" : delta < 0 ? "down" : "up",
      delta: delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`,
      sub: delta === null ? "pas de vente hier" : "vs hier",
    });
    return [
      { label: "CA du jour", value: fmt(stats.today.revenue), unit: "FCFA", icon: ICONS.trendUp, ...describe(stats.deltas.revenue) },
      { label: "Ventes", value: String(stats.today.transactions), unit: "", icon: ICONS.orders, ...describe(stats.deltas.transactions) },
      { label: "Panier moyen", value: fmt(stats.today.averageBasket), unit: "FCFA", icon: ICONS.cart, ...describe(stats.deltas.averageBasket) },
    ];
  }, [stats]);

  const trend = useMemo(() => {
    const raw = range === "7" ? stats.series7 : stats.series30;
    const max = Math.max(0, ...raw.map((r) => r.value));
    const peak = raw.findIndex((r) => r.value === max && max > 0);
    return raw.map((r, i) => ({
      label: r.label,
      h: max === 0 ? "0%" : Math.round((r.value / max) * 100) + "%",
      fill: i === peak ? colors.accent : colors.primary,
    }));
  }, [range, stats]);

  const lowStockAlerts = products.filter((p) => p.stock <= 9);
  const lowStock = lowStockAlerts.slice(0, 4);
  const lowStockCount = lowStockAlerts.length;
  const nouvelles = orders.filter((o) => o.status === "nouvelle");
  const toValidate = nouvelles.slice(0, 3);

  if (booting) {
    return (
      <div className="ft-pad" style={{ maxWidth: 1240 }}>
        <div className="ft-grid-3" style={{ marginBottom: 18 }}>
          <div className="ft-skeleton" style={{ height: 118 }} />
          <div className="ft-skeleton" style={{ height: 118 }} />
          <div className="ft-skeleton" style={{ height: 118 }} />
        </div>
        <div className="ft-skeleton" style={{ height: 280, marginBottom: 18 }} />
        <div className="ft-grid-2">
          <div className="ft-skeleton" style={{ height: 220 }} />
          <div className="ft-skeleton" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ft-pad" style={{ maxWidth: 1240 }}>
      {/* KPI */}
      <div className="ft-grid-3" style={{ marginBottom: 18 }}>
        {kpis.map((k) => (
          <div
            key={k.label}
            style={{
              background: "#fff",
              border: "1px solid rgba(30,27,24,.08)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.muted }}>{k.label}</span>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#EEF0F7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon path={k.icon} size={17} stroke={colors.primary} />
              </span>
            </div>
            <div style={{ fontFamily: fonts.display, fontSize: 30, fontWeight: 700, letterSpacing: "-.01em", marginBottom: 8 }}>
              {k.value}{" "}
              {k.unit && (
                <span style={{ fontFamily: fonts.ui, fontSize: 14, fontWeight: 600, color: colors.muted }}>{k.unit}</span>
              )}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                font: `600 12.5px ${fonts.ui}`,
                color: k.tone === "neutral" ? colors.muted : (k.tone === "up" ? colors.fgSuccess : colors.fgDanger),
                background: k.tone === "neutral" ? colors.bgInfo : (k.tone === "up" ? colors.bgSuccess : colors.bgDanger),
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              {k.tone !== "neutral" && (
                <Icon
                  path={k.tone === "up" ? ICONS.arrowUpRight : ICONS.arrowDownRight}
                  size={13}
                  stroke={k.tone === "up" ? colors.success : colors.danger}
                />
              )}
              {k.delta} {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* trend chart */}
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(30,27,24,.08)",
          borderRadius: 14,
          padding: "20px 22px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15.5 }}>Tendance des ventes</div>
            <div style={{ fontSize: 12.5, color: colors.muted }}>
              {range === "7" ? "Chiffre d'affaires quotidien" : "Chiffre d'affaires hebdomadaire"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, background: "#F1ECE2", padding: 3, borderRadius: 9 }}>
            {(["7", "30"] as const).map((r) => {
              const on = range === r;
              return (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    border: "none",
                    borderRadius: 7,
                    font: `600 12.5px ${fonts.ui}`,
                    cursor: "pointer",
                    background: on ? "#fff" : "transparent",
                    color: on ? colors.primary : colors.muted,
                  }}
                >
                  {r === "7" ? "7 jours" : "4 semaines"}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 200, paddingTop: 10 }}>
          {trend.map((b, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 46,
                  borderRadius: "7px 7px 0 0",
                  background: b.fill,
                  height: b.h,
                  transition: "height .3s",
                }}
              />
              <span style={{ fontSize: 10.5, color: colors.muted, whiteSpace: "nowrap" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* lower blocks */}
      <div className="ft-grid-2" style={{ marginBottom: 14 }}>
        {/* low stock */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          <div style={cardHead}>
            <Icon path={ICONS.alertTriangle} size={17} stroke={colors.warning} strokeWidth={1.9} />
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Alertes stock bas</span>
            <span style={pill(colors.bgWarning, colors.fgWarning)}>{lowStockCount}</span>
          </div>
          {lowStock.map((s) => (
            <div key={s.id} style={rowStyle}>
              <span style={{ width: 36, height: 36, borderRadius: 8, flex: "none", background: s.swatch }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ellip}>{s.name}</div>
                <div style={{ fontSize: 12, color: colors.muted }}>Seuil 10 · {s.variant}</div>
              </div>
              <span style={{ font: `700 13px ${fonts.ui}`, color: s.stock <= 5 ? colors.danger : colors.warning }}>
                {s.stock}
              </span>
            </div>
          ))}
          <div style={{ padding: "11px 18px" }}>
            <button onClick={() => router.push("/admin/inventaire")} style={linkBtn}>
              Voir l&apos;inventaire →
            </button>
          </div>
        </div>

        {/* orders to validate */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          <div style={cardHead}>
            <Icon path={ICONS.clipboardCheck} size={17} stroke={colors.primary} strokeWidth={1.9} />
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>Commandes à valider</span>
            <span style={pill(colors.bgInfo, colors.primary)}>{nouvelles.length}</span>
          </div>
          {toValidate.map((o) => (
            <div
              key={o.id}
              onClick={() => router.push(`/admin/commandes?sel=${encodeURIComponent(o.id)}`)}
              className="ft-hover-surface"
              style={{ ...rowStyle, cursor: "pointer" }}
            >
              <span style={avatar}>{initials(o.client)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {o.id} · {o.client}
                </div>
                <div style={{ fontSize: 12, color: colors.muted }}>
                  {o.items} articles · {o.channel} · {o.ago}
                </div>
              </div>
              <span style={{ font: `700 13.5px ${fonts.ui}`, color: colors.primary }}>{o.total}</span>
            </div>
          ))}
          <div style={{ padding: "11px 18px" }}>
            <button onClick={() => router.push("/admin/commandes")} style={linkBtn}>
              Traiter les commandes →
            </button>
          </div>
        </div>
      </div>

      {/* channel split */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "18px 22px" }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>Physique vs En ligne</div>
        <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>Répartition du CA aujourd&apos;hui</div>
        <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ width: "62%", background: colors.primary }} />
          <div style={{ width: "38%", background: colors.accent }} />
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Legend color={colors.primary} label="Boutique physique" value={money(153760)} />
          <Legend color={colors.accent} label="En ligne" value={money(94240)} />
        </div>
      </div>
    </div>
  );
}

const cardHead: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: `1px solid ${colors.borderSoft}`,
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 18px",
  borderBottom: `1px solid ${colors.faintLine}`,
};
const ellip: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const avatar: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "#EEF0F7",
  color: colors.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: 12,
  flex: "none",
};
const linkBtn: React.CSSProperties = {
  font: `600 13px ${fonts.ui}`,
  color: colors.primary,
  background: "none",
  border: "none",
  cursor: "pointer",
};
function pill(bg: string, color: string): React.CSSProperties {
  return {
    marginLeft: "auto",
    font: `600 11.5px ${fonts.ui}`,
    background: bg,
    color,
    padding: "3px 9px",
    borderRadius: 999,
  };
}
function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 13, color: colors.muted }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  );
}
