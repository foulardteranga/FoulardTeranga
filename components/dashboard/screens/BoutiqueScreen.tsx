"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { storefrontOrigin } from "@/lib/storefront/origin";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { updateTenantWhatsappPhone } from "@/lib/tenant/actions";
import type { TenantSettings } from "@/lib/data/tenant.server";

const SHORTCUTS = [
  { href: "/admin/personnalisation", label: "Personnalisation", desc: "Nom, slogan, couleurs, logo, coordonnées.", icon: ICONS.theme },
  { href: "/admin/vitrine", label: "Vitrine", desc: "Modules de la page d'accueil (drag-and-drop).", icon: ICONS.dash },
  { href: "/admin/inventaire", label: "Inventaire", desc: "Produits, variantes et stock du catalogue.", icon: ICONS.inv },
];

export function BoutiqueScreen({ tenant }: { tenant: TenantSettings }) {
  const initial = (tenant.shopName || "T").trim().charAt(0).toUpperCase();
  // Calculé après montage : évite un mismatch d'hydratation (window absent au SSR).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(storefrontOrigin()), []);

  const [phone, setPhone] = useState(tenant.phone);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(tenant.phone);
  const [savingPhone, setSavingPhone] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);

  async function handleSavePhone(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingPhone(true);
    const res = await updateTenantWhatsappPhone(phoneInput);
    setSavingPhone(false);
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    setPhone(res.phone);
    setIsEditingPhone(false);
    showToast("Numéro WhatsApp mis à jour avec succès !", "success");
  }

  function handleCancelEdit() {
    setPhoneInput(phone);
    setIsEditingPhone(false);
  }

  return (
    <div className="ft-pad">
      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <span
            style={{
              width: 48, height: 48, borderRadius: 12, background: tenant.primary, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: fonts.display, fontWeight: 700, fontSize: 20, flex: "none",
            }}
          >
            {initial}
          </span>
          <div>
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19 }}>{tenant.shopName}</div>
            <div style={{ fontSize: 13, color: colors.muted }}>{tenant.tagline}</div>
          </div>
        </div>

        {/* Section Contact WhatsApp */}
        <div
          style={{
            background: "#FBF9F5",
            border: "1px solid rgba(30,27,24,.08)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          {!isEditingPhone ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: "#E6F4EE",
                    color: colors.success,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon path={ICONS.whatsapp} size={20} stroke={colors.success} strokeWidth={1.8} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: colors.muted, fontWeight: 500, marginBottom: 2 }}>
                    Numéro WhatsApp client (vitrine &amp; commandes)
                  </div>
                  <div
                    style={{
                      font: `600 15px ${fonts.ui}`,
                      color: phone ? colors.ink : "#9A8F7D",
                      letterSpacing: phone ? "0.01em" : "normal",
                    }}
                  >
                    {phone || "Aucun numéro renseigné"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhoneInput(phone);
                  setIsEditingPhone(true);
                }}
                className="ft-hover-surface"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${colors.borderField}`,
                  background: "#fff",
                  color: colors.ink,
                  font: `600 12.5px ${fonts.ui}`,
                  cursor: "pointer",
                }}
              >
                <Icon path={ICONS.edit} size={14} stroke={colors.primary} strokeWidth={2} />
                Modifier
              </button>
            </div>
          ) : (
            <form onSubmit={handleSavePhone} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#E6F4EE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon path={ICONS.whatsapp} size={17} stroke={colors.success} strokeWidth={1.8} />
                </span>
                <span style={{ font: `600 13px ${fonts.ui}`, color: colors.ink }}>
                  Modifier le numéro WhatsApp
                </span>
              </div>
              <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.4 }}>
                Ce numéro est utilisé sur votre vitrine pour les boutons « Commander sur WhatsApp », le menu mobile et le contact d&apos;assistance.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+225 07 59 45 09 88"
                  autoFocus
                  style={{
                    flex: "1 1 220px",
                    height: 40,
                    padding: "0 12px",
                    border: `1.5px solid ${colors.primary}`,
                    borderRadius: 8,
                    font: `500 14px ${fonts.ui}`,
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={savingPhone}
                  className="ft-primary-btn"
                  style={{
                    height: 40,
                    padding: "0 16px",
                    border: "none",
                    borderRadius: 8,
                    background: colors.primary,
                    color: "#fff",
                    font: `600 13px ${fonts.ui}`,
                    cursor: savingPhone ? "default" : "pointer",
                    opacity: savingPhone ? 0.7 : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon path={ICONS.check} size={15} stroke="#fff" strokeWidth={2} />
                  {savingPhone ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingPhone}
                  style={{
                    height: 40,
                    padding: "0 12px",
                    border: `1.5px solid ${colors.borderField}`,
                    borderRadius: 8,
                    background: "#fff",
                    color: colors.muted,
                    font: `600 13px ${fonts.ui}`,
                    cursor: savingPhone ? "default" : "pointer",
                  }}
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        <a
          href={`${origin}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="ft-primary-btn"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, height: 46, padding: "0 18px",
            border: "none", borderRadius: 10, background: colors.primary, color: "#fff",
            font: `600 14px ${fonts.ui}`, cursor: "pointer",
          }}
        >
          <Icon path={ICONS.eye} size={17} stroke="#fff" strokeWidth={1.9} />
          Voir ma boutique en ligne
          <Icon path={ICONS.arrowUpRight} size={15} stroke="#fff" strokeWidth={2} />
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {SHORTCUTS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="ft-hover-surface"
            style={{
              background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14,
              padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, color: colors.ink,
            }}
          >
            <span
              style={{
                width: 38, height: 38, borderRadius: 10, background: colors.ivory,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon path={s.icon} size={19} stroke={colors.primary} strokeWidth={1.8} />
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
