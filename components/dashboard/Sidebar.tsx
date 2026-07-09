"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { NAV } from "@/lib/nav";
import { Icon } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { useNewOrdersCount } from "@/lib/store/useNewOrdersCount";

export function Sidebar() {
  const pathname = usePathname();
  const offline = useBackoffice((s) => s.offline);
  const toggleOffline = useBackoffice((s) => s.toggleOffline);
  const ordersBadge = useNewOrdersCount();

  return (
    <aside
      className="ft-desktop-only"
      style={{
        width: 236,
        flex: "none",
        background: colors.ink,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        padding: "16px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 8px 16px",
          borderBottom: "1px solid rgba(255,255,255,.1)",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: colors.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 17,
            color: "#fff",
          }}
        >
          T
        </span>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17 }}>
            Teranga
          </div>
          <div style={{ fontSize: 11, color: colors.navSub }}>Back-office</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          const badge = n.ordersBadge ? ordersBadge : 0;
          return (
            <Link
              key={n.id}
              href={n.href}
              title={n.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "11px 12px",
                borderRadius: 10,
                fontFamily: fonts.ui,
                fontWeight: 500,
                fontSize: 14,
                minHeight: 44,
                background: active ? colors.primary : "transparent",
                color: active ? "#fff" : colors.navIdle,
              }}
            >
              <span style={{ flex: "none", display: "flex" }}>
                <Icon path={n.icon} stroke={active ? "#fff" : colors.navIdle} />
              </span>
              <span>{n.label}</span>
              {badge > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: fonts.ui,
                    fontWeight: 700,
                    fontSize: 11,
                    background: colors.accent,
                    color: "#fff",
                    padding: "1px 7px",
                    borderRadius: 999,
                    minWidth: 20,
                    textAlign: "center",
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,.1)",
        }}
      >
        <button
          onClick={toggleOffline}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 10px",
            borderRadius: 10,
            cursor: "pointer",
            width: "100%",
            border: "none",
            textAlign: "left",
            background: offline ? "rgba(224,164,0,.14)" : "transparent",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: offline ? colors.warning : colors.success,
              flex: "none",
            }}
          />
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: offline ? colors.warning : colors.navIdle,
            }}
          >
            {offline ? "Hors-ligne" : "En ligne"}
          </span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 4px" }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 13,
              color: "#fff",
              flex: "none",
            }}
          >
            AK
          </span>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Aya Koffi
            </div>
            <div style={{ fontSize: 11, color: colors.navSub }}>Gérante</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
