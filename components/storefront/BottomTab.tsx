"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { cartCount } from "@/lib/store/cartLogic";

const TABS = [
  { id: "home", label: "Accueil", href: "/", icon: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>' },
  { id: "catalog", label: "Boutique", href: "/catalogue", icon: ICONS.search },
  { id: "cart", label: "Panier", href: "/panier", icon: ICONS.cart },
  { id: "account", label: "Compte", href: "/compte", icon: ICONS.user },
];

export function BottomTab() {
  const pathname = usePathname();
  const cart = useStorefront((s) => s.cart);
  const count = cartCount(cart);

  return (
    <nav
      className="ft-mobile-only"
      style={{
        position: "sticky", bottom: 0, zIndex: 50,
        background: "rgba(255,255,255,.96)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderTop: "1px solid #EAE4D9", display: "flex", justifyContent: "space-around", padding: "6px 4px 8px",
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const color = active ? colors.primary : "#8a8177";
        return (
          <Link
            key={tab.id}
            href={tab.href}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 56, height: 52, justifyContent: "center", color, position: "relative" }}
          >
            <span style={{ position: "relative", display: "flex" }}>
              <Icon path={tab.icon} size={23} stroke={color} strokeWidth={1.85} />
              {tab.id === "cart" && count > 0 && (
                <span
                  style={{
                    position: "absolute", top: -5, right: -7,
                    font: `700 9px ${fonts.ui}`, background: colors.accent, color: "#fff",
                    minWidth: 15, height: 15, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                  }}
                >
                  {count}
                </span>
              )}
            </span>
            <span style={{ font: `600 10.5px ${fonts.ui}` }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
