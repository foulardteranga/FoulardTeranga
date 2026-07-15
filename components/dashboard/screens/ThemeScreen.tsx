"use client";

import { useState } from "react";
import { colors, fonts, hexA } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { updateTenantTheme } from "@/lib/tenant/actions";
import type { TenantSettings } from "@/lib/data/tenant.server";
import type { Product } from "@/lib/data/types";

type ThemeState = TenantSettings;

const PRIMARY_PALETTE = ["#26326B", "#1E5F4E", "#7A2E5D", "#8a3a1c"];
const ACCENT_PALETTE = ["#D07A34", "#C9A227", "#B23A48", "#2E7D8A"];
const FONT_OPTIONS: Array<{ label: string; val: ThemeState["font"]; family: string }> = [
  { label: "Élégant", val: "Playfair Display", family: fonts.display },
  { label: "Moderne", val: "Inter", family: fonts.ui },
];

export function ThemeScreen({ products, tenant }: { products: Product[]; tenant: TenantSettings }) {
  const [th, setTh] = useState<ThemeState>(tenant);
  const [saving, setSaving] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);
  const set = <K extends keyof ThemeState>(k: K, v: ThemeState[K]) => setTh((s) => ({ ...s, [k]: v }));

  async function publish() {
    setSaving(true);
    const result = await updateTenantTheme(th);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("Vitrine mise à jour", "success");
  }

  const previewFont = th.font === "Inter" ? fonts.ui : fonts.display;
  const heroBg = `linear-gradient(180deg, ${hexA(th.accent, 0.1)}, #fff)`;
  const initial = (th.shopName || "T").trim().charAt(0).toUpperCase();
  const previewProducts = [products[0], products[1], products[2]];

  return (
    <div className="ft-pad">
      <div className="ft-theme-cols">
        {/* controls */}
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 18 }}>Apparence de la vitrine</div>

          <Field label="Nom de la boutique">
            <input value={th.shopName} onChange={(e) => set("shopName", e.target.value)} style={textField} />
          </Field>
          <Field label="Slogan">
            <input value={th.tagline} onChange={(e) => set("tagline", e.target.value)} style={textField} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
            <div>
              <label style={fieldLabel}>Logo</label>
              <div className="ft-dropzone" style={dropzone}>
                <Icon path={ICONS.image} size={20} stroke="#9a8f7d" strokeWidth={1.7} />
                <span style={{ fontSize: 11 }}>Déposer un logo</span>
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Favicon</label>
              <div className="ft-dropzone" style={dropzone}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: colors.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: fonts.display,
                    fontWeight: 700,
                    color: "#fff",
                    fontSize: 14,
                  }}
                >
                  T
                </span>
                <span style={{ fontSize: 11 }}>Remplacer</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel}>Couleur primaire</label>
            <Swatches palette={PRIMARY_PALETTE} value={th.primary} onSelect={(h) => set("primary", h)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel}>Couleur d&apos;accent</label>
            <Swatches palette={ACCENT_PALETTE} value={th.accent} onSelect={(h) => set("accent", h)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel}>Style typographique</label>
            <div style={{ display: "flex", gap: 8 }}>
              {FONT_OPTIONS.map((fo) => {
                const on = th.font === fo.val;
                return (
                  <button
                    key={fo.val}
                    onClick={() => set("font", fo.val)}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 10,
                      cursor: "pointer",
                      border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                      background: on ? "#EEF0F7" : "#fff",
                      color: on ? colors.primary : colors.muted,
                      fontFamily: fo.family,
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {fo.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Coordonnées (WhatsApp / tél.)">
            <input value={th.phone} onChange={(e) => set("phone", e.target.value)} style={textField} />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={() => setTh(tenant)}
              disabled={saving}
              style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer" }}
            >
              Réinitialiser
            </button>
            <button
              onClick={publish}
              disabled={saving}
              className="ft-primary-btn"
              style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Publication…" : "Publier"}
            </button>
          </div>
        </div>

        {/* live preview */}
        <div style={{ position: "sticky", top: 80 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, color: colors.muted }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: colors.success, animation: "ft-pulse 1.6s infinite" }} />
            Aperçu live de la vitrine
          </div>
          <div style={{ border: "1px solid rgba(30,27,24,.12)", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 28px rgba(60,40,20,.14)", background: "#fff" }}>
            {/* browser chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", background: "#F1ECE2", borderBottom: "1px solid #E3DCD0" }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#d9b4ab" }} />
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#e6d3a0" }} />
              <span style={{ width: 9, height: 9, borderRadius: 999, background: "#b9d3bf" }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: "#9a8f7d", fontFamily: "ui-monospace,monospace" }}>foulardteranga.ci</span>
            </div>
            {/* store header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #F1ECE2" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: previewFont,
                    fontWeight: 700,
                    color: "#fff",
                    fontSize: 15,
                    background: th.primary,
                  }}
                >
                  {initial}
                </span>
                <span style={{ fontFamily: previewFont, fontWeight: 600, fontSize: 17, color: th.primary }}>{th.shopName}</span>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: colors.muted }}>
                <span>Foulards</span>
                <span>Turbans</span>
                <span>Accessoires</span>
              </div>
            </div>
            {/* hero */}
            <div style={{ padding: "26px 20px", textAlign: "center", background: heroBg }}>
              <div style={{ fontFamily: previewFont, fontWeight: 700, fontSize: 26, lineHeight: 1.15, color: colors.ink, marginBottom: 8 }}>
                {th.tagline}
              </div>
              <div style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>
                Foulards &amp; accessoires tissés main, livrés partout à Abidjan.
              </div>
              <button style={{ height: 44, padding: "0 22px", border: "none", borderRadius: 10, color: "#fff", font: `700 14px ${fonts.ui}`, cursor: "pointer", background: th.accent }}>
                Commander maintenant
              </button>
            </div>
            {/* products */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "16px 18px 20px" }}>
              {previewProducts.map((p) => (
                <div key={p.id}>
                  <div style={{ aspectRatio: "4 / 5", borderRadius: 10, background: p.swatch, marginBottom: 7 }} />
                  <div style={{ fontFamily: previewFont, fontWeight: 600, fontSize: 12.5, lineHeight: 1.2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: th.primary }}>{money(p.price)}</div>
                </div>
              ))}
            </div>
            {/* footer */}
            <div style={{ padding: "12px 18px", background: colors.ivory, borderTop: "1px solid #F1ECE2", fontSize: 11.5, color: colors.muted, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: previewFont, fontWeight: 600, color: th.primary }}>{th.shopName}</span>
              <span>{th.phone}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function Swatches({ palette, value, onSelect }: { palette: string[]; value: string; onSelect: (hex: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {palette.map((h) => (
        <button
          key={h}
          onClick={() => onSelect(h)}
          title={h}
          aria-label={h}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            cursor: "pointer",
            background: h,
            border: `3px solid ${value === h ? colors.ink : "transparent"}`,
          }}
        />
      ))}
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 8 };
const textField: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 13px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14px ${fonts.ui}`,
};
const dropzone: React.CSSProperties = {
  height: 72,
  border: `1.5px dashed ${colors.borderField}`,
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  color: "#9a8f7d",
  cursor: "pointer",
  background: colors.ivory,
};
