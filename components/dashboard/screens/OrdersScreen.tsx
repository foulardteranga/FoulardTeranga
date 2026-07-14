"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { statusMeta } from "@/lib/data/orderStatus";
import { initials } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { confirmOrder, rejectOrder } from "@/lib/orders/actions";
import type { Order, OrderStatus } from "@/lib/data/types";

const FILTERS: Array<[string, string, OrderStatus | null]> = [
  ["toValidate", "À valider", "nouvelle"],
  ["confirmee", "Confirmées", "confirmee"],
  ["preparation", "En préparation", "preparation"],
  ["livree", "Livrées", "livree"],
  ["refusee", "Refusées", "refusee"],
  ["all", "Toutes", null],
];

export function OrdersScreen({ orders, initialSel }: { orders: Order[]; initialSel?: string }) {
  const [filter, setFilter] = useState<string>("toValidate");
  const [selId, setSelId] = useState<string | null>(initialSel ?? null);

  const showToast = useBackoffice((s) => s.showToast);

  const cur = FILTERS.find((f) => f[0] === filter)!;
  const list = orders.filter((o) => (filter === "all" ? true : o.status === cur[2]));

  const selected: Order | undefined =
    orders.find((o) => o.id === selId) ?? list[0] ?? orders[0];

  const count = (st: OrderStatus | null) =>
    st === null ? orders.length : orders.filter((o) => o.status === st).length;

  return (
    <div className="ft-pad">
      {/* info banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#EEF0F7",
          border: "1px solid #d4dbf0",
          borderRadius: 12,
          padding: "11px 15px",
          marginBottom: 16,
          fontSize: 13,
          color: colors.primary,
        }}
      >
        <Icon path={ICONS.info} size={18} stroke={colors.primary} strokeWidth={1.8} style={{ flex: "none" }} />
        <span style={{ flex: 1 }}>
          Le stock n&apos;est déduit qu&apos;à la <strong>validation</strong> d&apos;une commande.
        </span>
      </div>

      {/* filter tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, overflowX: "auto" }}>
        {FILTERS.map((f) => {
          const on = filter === f[0];
          const c = f[0] === "all" ? orders.length : count(f[2]);
          return (
            <button
              key={f[0]}
              onClick={() => {
                setFilter(f[0]);
                setSelId(null);
              }}
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 999,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                whiteSpace: "nowrap",
                border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                background: on ? colors.primary : "#fff",
                color: on ? "#fff" : colors.muted,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {f[1]}
              <span
                style={{
                  fontSize: 11,
                  background: on ? "rgba(255,255,255,.22)" : "#F1ECE2",
                  color: on ? "#fff" : colors.muted,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ft-orders-cols">
        {/* list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid rgba(30,27,24,.08)",
                borderRadius: 14,
                textAlign: "center",
                padding: "50px 24px",
                color: colors.muted,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 13,
                  background: "#F1ECE2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Icon path={ICONS.check} size={24} stroke="#B6AEA1" strokeWidth={1.6} />
              </div>
              <div style={{ fontWeight: 600, color: colors.ink, marginBottom: 4 }}>Rien par ici</div>
              <div style={{ fontSize: 13 }}>Aucune commande dans ce statut.</div>
            </div>
          ) : (
            list.map((o) => {
              const st = statusMeta[o.status];
              return (
                <div
                  key={o.id}
                  onClick={() => setSelId(o.id)}
                  style={{
                    background: "#fff",
                    border: `1.5px solid ${selId === o.id ? colors.primary : "rgba(30,27,24,.08)"}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                      <span style={avatar}>{initials(o.client)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{o.id}</div>
                        <div style={{ fontSize: 12.5, color: colors.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {o.client} · {o.place}
                        </div>
                      </div>
                    </div>
                    <Badge meta={st} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: colors.muted }}>
                      {o.items} articles · {o.channel} · {o.ago}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: colors.primary }}>{o.total}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* detail (desktop) */}
        {selected && (
          <div
            className="ft-desktop-only"
            style={{
              background: "#fff",
              border: "1px solid rgba(30,27,24,.08)",
              borderRadius: 14,
              overflow: "hidden",
              position: "sticky",
              top: 80,
            }}
          >
            <OrderDetail
              order={selected}
              status={selected.status}
              onValidate={async () => {
                const result = await confirmOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande validée — stock déduit", "success");
              }}
              onRefuse={async () => {
                const result = await rejectOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande refusée", "error");
              }}
              onEdit={() => showToast("Édition de la commande…", "success")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ meta }: { meta: (typeof statusMeta)[OrderStatus] }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        font: `600 11.5px ${fonts.ui}`,
        padding: "4px 9px",
        borderRadius: 999,
        flex: "none",
        background: meta.bg,
        color: meta.color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function OrderDetail({
  order: o,
  status,
  onValidate,
  onRefuse,
  onEdit,
}: {
  order: Order;
  status: OrderStatus;
  onValidate: () => void;
  onRefuse: () => void;
  onEdit: () => void;
}) {
  const meta = statusMeta[status];
  const actionable = status === "nouvelle";
  const done = status === "livree" || status === "refusee" || status === "confirmee";
  const doneWord = status === "refusee" ? "refusée" : status === "confirmee" ? "confirmée" : "livrée";

  return (
    <>
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19 }}>{o.id}</div>
          <div style={{ fontSize: 12.5, color: colors.muted }}>
            {o.date} · {o.channel}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            font: `600 12px ${fonts.ui}`,
            padding: "5px 11px",
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.dot }} />
          {meta.label}
        </span>
      </div>

      <div style={{ padding: "16px 18px" }}>
        {/* KYC */}
        <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: "13px 15px", marginBottom: 14 }}>
          <div style={kycLabel}>Mini-fiche cliente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <Icon path={ICONS.user} size={15} stroke={colors.muted} strokeWidth={1.8} />
              <span style={{ fontWeight: 600 }}>{o.client}</span>
              {o.vip && (
                <span style={{ font: `600 10.5px ${fonts.ui}`, background: colors.ink, color: colors.gold, padding: "2px 7px", borderRadius: 999, border: `1px solid ${colors.gold}` }}>
                  ★ VIP
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "center", color: colors.muted }}>
              <Icon path={ICONS.phone} size={15} stroke={colors.muted} strokeWidth={1.8} />
              {o.phone}
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", color: colors.muted }}>
              <Icon path={ICONS.mapPin} size={15} stroke={colors.muted} strokeWidth={1.8} style={{ flex: "none", marginTop: 1 }} />
              {o.place}
            </div>
          </div>
        </div>

        {/* items */}
        <div style={kycLabel}>Panier</div>
        <div style={{ border: `1px solid ${colors.borderSoft}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          {o.lines.map((li, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 13px", borderBottom: `1px solid ${colors.faintLine}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{li.name}</div>
                <div style={{ fontSize: 11.5, color: colors.muted }}>
                  {li.qty} × {li.price}
                </div>
              </div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{li.total}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 13px", background: colors.rowAlt }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 19, color: colors.primary }}>{o.total}</span>
          </div>
        </div>

        <button
          className="ft-hover-surface"
          style={{
            width: "100%",
            height: 44,
            border: `1.5px solid ${colors.success}`,
            borderRadius: 10,
            background: colors.bgSuccess,
            color: colors.fgSuccess,
            font: `600 13.5px ${fonts.ui}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginBottom: 14,
          }}
        >
          <Icon path={ICONS.whatsapp} size={17} stroke={colors.success} strokeWidth={1.9} />
          Contacter la cliente (WhatsApp / appel)
        </button>

        {actionable ? (
          <>
            <div style={{ display: "flex", gap: 9 }}>
              <button
                onClick={onRefuse}
                style={{ flex: 1, height: 48, border: `1.5px solid ${colors.danger}`, borderRadius: 10, background: "#fff", color: colors.danger, font: `600 14px ${fonts.ui}`, cursor: "pointer" }}
              >
                Refuser
              </button>
              <button
                onClick={onEdit}
                style={{ flex: 1, height: 48, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: "pointer" }}
              >
                Modifier
              </button>
              <button
                onClick={onValidate}
                className="ft-primary-btn"
                style={{ flex: 2, height: 48, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `700 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon path={ICONS.check} size={18} stroke="#fff" strokeWidth={2} />
                Valider
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: colors.fgWarning, background: colors.bgWarning, borderRadius: 8, padding: "8px 11px", marginTop: 10, display: "flex", gap: 7, alignItems: "center" }}>
              <Icon path={ICONS.infoAlt} size={14} stroke={colors.warning} strokeWidth={2} />
              Valider déduira le stock des articles.
            </div>
          </>
        ) : (
          done && (
            <div style={{ textAlign: "center", fontSize: 13, color: colors.muted, padding: 8 }}>
              Commande {doneWord}. Stock à jour.
            </div>
          )
        )}
      </div>
    </>
  );
}

const kycLabel: React.CSSProperties = {
  font: `600 11px ${fonts.ui}`,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: colors.muted,
  marginBottom: 10,
};
const avatar: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  background: "#EEF0F7",
  color: colors.primary,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: 13,
  flex: "none",
};
