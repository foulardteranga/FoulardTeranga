"use client";

import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { cartCount } from "@/lib/store/cartLogic";

const NAV_LINKS = [
  { label: "Boutique", href: "/catalogue" },
  { label: "Nouveautés", href: "/catalogue?cat=Nouveautés" },
  { label: "Foulards", href: "/catalogue?cat=Foulards" },
  { label: "Turbans", href: "/catalogue?cat=Turbans" },
  { label: "Accessoires", href: "/catalogue?cat=Accessoires" },
  { label: "Notre histoire", href: "/#ft-story" },
];

export function StoreHeader() {
  const cart = useStorefront((s) => s.cart);
  const offline = useStorefront((s) => s.offline);
  const toggleOffline = useStorefront((s) => s.toggleOffline);
  const openMenu = useStorefront((s) => s.openMenu);
  const count = cartCount(cart);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(250,247,242,.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(30,27,24,.08)",
      }}
    >
      <div className="ft-store-header-pad" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={openMenu}
          className="ft-mobile-only"
          aria-label="Ouvrir le menu"
          style={{ width: 44, height: 44, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: -8 }}
        >
          <Icon path={ICONS.menu} size={24} stroke={colors.ink} strokeWidth={1.75} />
        </button>

        <Link href="/" className="ft-store-logo" style={{ fontFamily: fonts.display, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1, color: colors.ink }}>
          Foulard <span style={{ color: colors.accent }}>Teranga</span>
        </Link>

        <nav className="ft-desktop-only" style={{ display: "flex", gap: 26, marginLeft: 32, font: `500 15px ${fonts.ui}` }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} style={{ color: colors.ink }}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/catalogue" title="Rechercher" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon path={ICONS.search} size={22} stroke={colors.ink} strokeWidth={1.75} />
          </Link>
          <button
            onClick={toggleOffline}
            title="Simuler hors-ligne"
            aria-label="Basculer le mode hors-ligne (démo)"
            style={{ width: 44, height: 44, border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 999, background: offline ? colors.warning : colors.success }} />
          </button>
          <Link href="/compte" title="Mon compte" className="ft-desktop-only" style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon path={ICONS.user} size={22} stroke={colors.ink} strokeWidth={1.75} />
          </Link>
          <Link href="/panier" title="Panier" style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon path={ICONS.cart} size={22} stroke={colors.ink} strokeWidth={1.75} />
            {count > 0 && (
              <span
                style={{
                  position: "absolute", top: 4, right: 2,
                  font: `700 10px ${fonts.ui}`, background: colors.accent, color: "#fff",
                  minWidth: 17, height: 17, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
                }}
              >
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
