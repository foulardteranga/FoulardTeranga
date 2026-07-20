"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { NumericField } from "@/components/ui/NumericField";
import { money } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { createPromoCode, setPromoCodeActive } from "@/lib/marketing/actions";
import type { Product } from "@/lib/data/types";
import type { PromoCodeView } from "@/lib/data/promos.server";

export function MarketingScreen({ products, promos }: { products: Product[]; promos: PromoCodeView[] }) {
  const showToast = useBackoffice((s) => s.showToast);
  const [form, setForm] = useState({
    code: "",
    kind: "percent" as "percent" | "amount",
    value: "10",
    minTotal: "",
    startsAt: "",
    endsAt: "",
    vipOnly: false,
  });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    const minTotal = Number(form.minTotal);
    const r = await createPromoCode({
      code: form.code,
      kind: form.kind,
      value: Number(form.value),
      minTotal: minTotal > 0 ? minTotal : undefined,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
      vipOnly: form.vipOnly,
    });
    setSaving(false);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast("Code promo créé.", "success");
    setForm({ code: "", kind: "percent", value: "10", minTotal: "", startsAt: "", endsAt: "", vipOnly: false });
  }

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
            {promos.length === 0 && (
              <p style={{ fontSize: 13, color: colors.muted, padding: "10px 0" }}>Aucun code pour l&apos;instant — créez le premier ci-contre.</p>
            )}
            {promos.map((pr) => (
              <div
                key={pr.id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: `1px solid ${colors.faintLine}`, opacity: pr.active ? 1 : 0.55 }}
              >
                <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700, fontSize: 13, background: colors.ink, color: colors.gold, padding: "5px 10px", borderRadius: 8 }}>
                  {pr.code}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{promoDesc(pr)}</div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>{promoPeriod(pr)}</div>
                </div>
                <span style={{ font: `600 11px ${fonts.ui}`, background: colors.bgSuccess, color: colors.fgSuccess, padding: "3px 9px", borderRadius: 999 }}>
                  {pr.usedCount} util.
                </span>
                <button
                  onClick={async () => {
                    const r = await setPromoCodeActive(pr.id, !pr.active);
                    if (!r.ok) showToast(r.error, "error");
                  }}
                  style={{
                    height: 30,
                    padding: "0 11px",
                    border: `1.5px solid ${colors.borderField}`,
                    borderRadius: 8,
                    background: "#fff",
                    font: `600 12px ${fonts.ui}`,
                    color: pr.active ? colors.muted : colors.fgSuccess,
                    cursor: "pointer",
                  }}
                >
                  {pr.active ? "Désactiver" : "Activer"}
                </button>
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
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="TERANGA10"
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
                <SelectField value={form.kind} onChange={(v) => setForm({ ...form, kind: v as "percent" | "amount" })}>
                  <option value="percent">Pourcentage</option>
                  <option value="amount">Montant fixe</option>
                </SelectField>
              </div>
              <div>
                <label style={fieldLabel}>Valeur</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <NumericField
                      mode="integer"
                      value={form.value}
                      onChange={(v) => setForm({ ...form, value: v })}
                      min={1}
                      max={form.kind === "percent" ? 100 : undefined}
                    />
                  </div>
                  <span style={{ color: colors.muted, fontSize: 13, flex: "none" }}>{form.kind === "percent" ? "%" : "FCFA"}</span>
                </div>
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Achat minimum</label>
              <NumericField mode="money" value={form.minTotal} onChange={(v) => setForm({ ...form, minTotal: v })} min={0} placeholder="0 = aucun" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={fieldLabel}>Début</label>
                <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} style={textField} />
              </div>
              <div>
                <label style={fieldLabel}>Fin</label>
                <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} style={textField} />
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Cible</label>
              <SelectField value={form.vipOnly ? "vip" : "all"} onChange={(v) => setForm({ ...form, vipOnly: v === "vip" })}>
                <option value="all">Toutes les clientes</option>
                <option value="vip">Clientes VIP</option>
              </SelectField>
            </div>
            <button
              className="ft-primary-btn"
              onClick={handleCreate}
              disabled={saving || !form.code}
              style={{
                height: 48,
                border: "none",
                borderRadius: 10,
                background: colors.accent,
                color: "#fff",
                font: `700 15px ${fonts.ui}`,
                cursor: saving || !form.code ? "not-allowed" : "pointer",
                opacity: saving || !form.code ? 0.6 : 1,
                marginTop: 2,
              }}
            >
              {saving ? "Création…" : "Créer le code promo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function promoDesc(pr: PromoCodeView): string {
  const remise = pr.kind === "percent" ? `−${pr.value}%` : `−${money(pr.value)}`;
  const min = pr.minTotal ? ` dès ${money(pr.minTotal)}` : "";
  const cible = pr.vipOnly ? " · clientes VIP" : "";
  return `${remise}${min}${cible}`;
}
function promoPeriod(pr: PromoCodeView): string {
  const f = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");
  if (pr.startsAt && pr.endsAt) return `${f(pr.startsAt)} → ${f(pr.endsAt)}`;
  if (pr.endsAt) return `Jusqu'au ${f(pr.endsAt)}`;
  if (pr.startsAt) return `À partir du ${f(pr.startsAt)}`;
  return "Permanent";
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

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        {children}
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
const textField: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 13px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14px ${fonts.ui}`,
};
