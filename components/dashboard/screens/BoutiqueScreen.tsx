"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { storefrontOrigin } from "@/lib/storefront/origin";
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: colors.muted, marginBottom: 18 }}>
          {tenant.phone && (
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Icon path={ICONS.phone} size={15} stroke={colors.muted} strokeWidth={1.8} />
              {tenant.phone}
            </span>
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
