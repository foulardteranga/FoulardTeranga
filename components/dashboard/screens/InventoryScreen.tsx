"use client";

import { useMemo, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";
import { useShop } from "@/lib/store/useShop";
import { computeEffectiveStock } from "@/lib/store/shopLogic";

function lvlDot(v: number, seuil: number): string {
  if (v <= Math.round(seuil * 0.5)) return colors.danger;
  if (v <= seuil) return colors.warning;
  return colors.success;
}

const HISTORY = [
  { date: "05/07", type: "Entrée atelier", qty: "+12", color: colors.fgSuccess },
  { date: "03/07", type: "Vente boutique", qty: "−3", color: colors.fgDanger },
  { date: "01/07", type: "Ajustement inventaire", qty: "−1", color: colors.fgDanger },
];

export function InventoryScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const stockDeductions = useShop((s) => s.stockDeductions);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      products.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      ),
    [products, q]
  );

  const drawerProduct = drawerId ? products.find((p) => p.id === drawerId) ?? null : null;

  return (
    <div className="ft-pad">
      {/* toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div
          style={{
            flex: 1,
            minWidth: 180,
            display: "flex",
            alignItems: "center",
            height: 42,
            padding: "0 13px",
            border: `1.5px solid ${colors.borderField}`,
            borderRadius: 10,
            background: "#fff",
            gap: 9,
          }}
        >
          <Icon path={ICONS.search} size={17} stroke={colors.muted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit, une référence…"
            style={{ flex: 1, border: "none", outline: "none", font: `400 14px ${fonts.ui}`, background: "transparent" }}
          />
        </div>
        <ToolbarBtn icon={ICONS.download} label="Importer CSV" />
        <ToolbarBtn icon={ICONS.upload} label="Exporter" />
        <button
          className="ft-primary-btn"
          style={{
            height: 42,
            padding: "0 16px",
            border: "none",
            borderRadius: 10,
            background: colors.primary,
            color: "#fff",
            font: `600 13px ${fonts.ui}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon path={ICONS.plus} size={17} stroke="#fff" strokeWidth={2} />
          Produit
        </button>
      </div>

      {/* table */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
            <thead>
              <tr style={{ background: colors.ivory, color: colors.muted, textAlign: "left" }}>
                <th style={th("16px")}>Produit</th>
                <th style={th("10px")}>Variante</th>
                <th style={{ ...th("10px"), textAlign: "center" }}>Interne</th>
                <th style={{ ...th("10px"), textAlign: "center" }}>Sous-traitance</th>
                <th style={{ ...th("10px"), textAlign: "center" }}>Matériel</th>
                <th style={{ ...th("10px"), textAlign: "right" }}>Prix</th>
                <th style={{ ...th("16px"), textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const s1 = computeEffectiveStock(p.id, p.stock, stockDeductions);
                const s2 = Math.max(0, Math.round(p.stock * 0.4));
                const s3 = Math.round(p.stock * 0.25) + 2;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDrawerId(p.id)}
                    className="ft-hover-row"
                    style={{ borderTop: "1px solid #EFEAE0", background: i % 2 ? colors.rowAlt : "#fff", cursor: "pointer" }}
                  >
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 8, flex: "none", background: p.swatch }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#9a8f7d" }}>REF-{p.id.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: 10, color: colors.muted }}>{p.variant}</td>
                    <StockCell value={s1} dot={lvlDot(s1, 10)} />
                    <StockCell value={s2} dot={lvlDot(s2, 6)} />
                    <StockCell value={s3} dot={lvlDot(s3, 5)} />
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 600 }}>{money(p.price)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: `600 12px ${fonts.ui}`, color: colors.primary }}>
                        Mouvement
                        <Icon path={ICONS.chevronRight} size={14} stroke="currentColor" strokeWidth={2} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${colors.borderSoft}`,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12.5, color: colors.muted }}>
            {rows.length} produits · {products.length} au total
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <PageBtn disabled>‹</PageBtn>
            <PageBtn active>1</PageBtn>
            <PageBtn>2</PageBtn>
            <PageBtn>›</PageBtn>
          </div>
        </div>
      </div>

      {drawerProduct && <EditDrawer product={drawerProduct} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

function th(px: string): React.CSSProperties {
  return {
    padding: `11px ${px}`,
    font: `600 11.5px ${fonts.ui}`,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };
}

function StockCell({ value, dot }: { value: number; dot: string }) {
  return (
    <td style={{ padding: 10, textAlign: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 12.5px ${fonts.ui}` }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
        {value}
      </span>
    </td>
  );
}

function ToolbarBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      className="ft-hover-surface"
      style={{
        height: 42,
        padding: "0 14px",
        border: `1.5px solid ${colors.borderField}`,
        borderRadius: 10,
        background: "#fff",
        color: colors.ink,
        font: `600 13px ${fonts.ui}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon path={icon} size={16} stroke={colors.muted} strokeWidth={1.9} />
      {label}
    </button>
  );
}

function PageBtn({ children, active, disabled }: { children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      style={{
        height: 32,
        minWidth: 32,
        padding: "0 9px",
        border: `1px solid ${active ? colors.primary : colors.borderField}`,
        borderRadius: 8,
        background: active ? colors.primary : "#fff",
        color: active ? "#fff" : disabled ? "#B6AEA1" : colors.ink,
        font: `600 12.5px ${fonts.ui}`,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function EditDrawer({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const stockDeductions = useShop((s) => s.stockDeductions);
  const s1 = computeEffectiveStock(p.id, p.stock, stockDeductions);
  const s2 = Math.round(p.stock * 0.4);
  const s3 = Math.round(p.stock * 0.25) + 2;
  const stocks = [
    { label: "Stock interne (boutique)", qty: s1, seuil: 10, dot: lvlDot(s1, 10) },
    { label: "Sous-traitance (atelier)", qty: s2, seuil: 6, dot: lvlDot(s2, 6) },
    { label: "Matériel & fournitures", qty: s3, seuil: 5, dot: colors.success },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 50 }} />
      <div
        className="ft-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          maxWidth: "100vw",
          background: "#fff",
          boxShadow: "-8px 0 32px rgba(60,40,20,.18)",
          display: "flex",
          flexDirection: "column",
          animation: "ft-fade .16s ease",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 10, flex: "none", background: p.swatch }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, lineHeight: 1.15 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "#9a8f7d" }}>
              REF-{p.id.toUpperCase()} · {p.cat}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: "none", background: "#F1ECE2", width: 34, height: 34, borderRadius: 999, fontSize: 18, cursor: "pointer", color: colors.muted }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          <div style={sectionLabel}>Stock par emplacement</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            {stocks.map((st) => (
              <div
                key={st.label}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 999, background: st.dot, flex: "none" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{st.label}</div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>Seuil d&apos;alerte {st.seuil}</div>
                </div>
                <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22, color: st.dot }}>{st.qty}</span>
              </div>
            ))}
          </div>

          <div style={sectionLabel}>Mouvement de stock</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            <MoveBtn color={colors.success} bg={colors.bgSuccess} fg={colors.fgSuccess} icon={ICONS.plus} label="Entrée" />
            <MoveBtn color={colors.danger} bg={colors.bgDanger} fg={colors.fgDanger} icon={ICONS.minus} label="Sortie" />
            <button
              style={{
                height: 44,
                border: `1.5px solid ${colors.borderField}`,
                borderRadius: 10,
                background: "#fff",
                color: colors.primary,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon path={ICONS.refresh} size={15} stroke={colors.primary} strokeWidth={1.9} />
              Ajuster
            </button>
          </div>

          <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Derniers mouvements</div>
            {HISTORY.map((h) => (
              <div key={h.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5 }}>
                <span style={{ color: colors.muted }}>
                  {h.date} · {h.type}
                </span>
                <span style={{ fontWeight: 600, color: h.color }}>{h.qty}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${colors.borderSoft}`, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: "pointer" }}
          >
            Annuler
          </button>
          <button
            onClick={onClose}
            style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: "pointer" }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}

const sectionLabel: React.CSSProperties = {
  font: `600 12px ${fonts.ui}`,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: colors.muted,
  marginBottom: 12,
};

function MoveBtn({ color, bg, fg, icon, label }: { color: string; bg: string; fg: string; icon: string; label: string }) {
  return (
    <button
      style={{
        height: 44,
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        background: bg,
        color: fg,
        font: `600 13px ${fonts.ui}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Icon path={icon} size={15} stroke={color} strokeWidth={2} />
      {label}
    </button>
  );
}
