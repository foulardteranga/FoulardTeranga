"use client";

import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";

const LINKS = [
  { label: "Nouveautés", href: "/catalogue?cat=Nouveautés" },
  { label: "Foulards", href: "/catalogue?cat=Foulards" },
  { label: "Turbans", href: "/catalogue?cat=Turbans" },
  { label: "Accessoires", href: "/catalogue?cat=Accessoires" },
  { label: "Notre histoire", href: "/#ft-story" },
  { label: "Mon compte", href: "/compte" },
];

export function MobileMenu() {
  const menuOpen = useStorefront((s) => s.menuOpen);
  const closeMenu = useStorefront((s) => s.closeMenu);

  if (!menuOpen) return null;

  return (
    <div onClick={closeMenu} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(30,27,24,.4)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: 284, maxWidth: "82vw",
          background: colors.ivory, boxShadow: "8px 0 24px rgba(60,40,20,.18)", padding: "22px 20px",
          animation: "ft-fade .18s ease", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20 }}>
            Foulard <span style={{ color: colors.accent }}>Teranga</span>
          </span>
          <button
            onClick={closeMenu}
            aria-label="Fermer le menu"
            style={{ width: 36, height: 36, border: "1px solid rgba(30,27,24,.08)", borderRadius: 8, background: "#fff", cursor: "pointer" }}
          >
            <Icon path={ICONS.close} size={18} stroke={colors.ink} strokeWidth={2} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {LINKS.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={closeMenu}
              style={{
                padding: "14px 4px", font: `600 17px ${fonts.ui}`, color: colors.ink,
                borderBottom: i < LINKS.length - 1 ? "1px solid #EAE4D9" : "none",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 16, background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14 }}>
          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 6 }}>Une question ?</div>
          <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8, font: `600 14px ${fonts.ui}`, color: colors.success }}>
            <Icon path={ICONS.whatsapp} size={18} stroke={colors.success} strokeWidth={1.75} />
            Écrire sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
