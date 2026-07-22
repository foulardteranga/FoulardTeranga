"use client";

import { useRouter, usePathname } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { NAV, MORE_ROUTES } from "@/lib/nav";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { hasModuleAccess, type Session } from "@/lib/auth/session";

const TAB_IDS = ["pos", "dash", "orders", "inv"];

export function MobileNav({ pendingCount, session }: { pendingCount: number; session: Session | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const moreOpen = useBackoffice((s) => s.moreOpen);
  const openMore = useBackoffice((s) => s.openMore);
  const closeMore = useBackoffice((s) => s.closeMore);

  const visibleIds = new Set(
    NAV.filter((n) => (n.id === "equipe" ? session?.role === "owner" : hasModuleAccess(session, n.id))).map(
      (n) => n.id
    )
  );
  const tabs = TAB_IDS.filter((id) => visibleIds.has(id)).map((id) => NAV.find((n) => n.id === id)!);
  const moreItems = MORE_ROUTES.filter((id) => visibleIds.has(id)).map((id) => NAV.find((n) => n.id === id)!);
  const moreActive = moreOpen || moreItems.some((m) => m.href === pathname);

  const go = (href: string) => {
    closeMore();
    router.push(href);
  };

  return (
    <>
      <nav
        className="ft-mobile-only"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          display: "flex",
          background: "#fff",
          borderTop: "1px solid rgba(30,27,24,.1)",
          padding: "6px 4px 8px",
        }}
      >
        {tabs.map((t) => {
          const active = pathname === t.href;
          const badge = t.ordersBadge ? pendingCount : 0;
          return (
            <button
              key={t.id}
              onClick={() => go(t.href)}
              style={tabBtn(active ? colors.primary : "#9a8f7d")}
            >
              <span style={{ display: "flex" }}>
                <Icon path={t.icon} size={22} stroke={active ? colors.primary : "#9a8f7d"} />
              </span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t.short}</span>
              {badge > 0 && <TabBadge>{badge}</TabBadge>}
            </button>
          );
        })}
        <button
          onClick={openMore}
          style={tabBtn(moreActive ? colors.primary : "#9a8f7d")}
        >
          <span style={{ display: "flex" }}>
            <Icon path={ICONS.more} size={22} stroke={moreActive ? colors.primary : "#9a8f7d"} />
          </span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Plus</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div
            onClick={closeMore}
            style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 50 }}
          />
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 51,
              background: "#fff",
              borderRadius: "18px 18px 0 0",
              padding: "8px 12px 24px",
              animation: "ft-slideup .2s cubic-bezier(.2,.8,.2,1)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                background: colors.borderField,
                margin: "8px auto 12px",
              }}
            />
            {moreItems.map((m) => (
              <div
                key={m.id}
                onClick={() => go(m.href)}
                className="ft-hover-surface"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  minHeight: 52,
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "#EEF0F7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon path={m.icon} size={20} stroke={colors.primary} />
                </span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{m.label}</span>
                <Icon
                  path={ICONS.chevronRight}
                  size={18}
                  stroke="#B6AEA1"
                  strokeWidth={2}
                  style={{ marginLeft: "auto" }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function tabBtn(color: string): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 52,
    border: "none",
    background: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    color,
    position: "relative",
  };
}

function TabBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        top: 4,
        right: "22%",
        font: `700 9px ${fonts.ui}`,
        background: colors.accent,
        color: "#fff",
        minWidth: 15,
        height: 15,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 3px",
      }}
    >
      {children}
    </span>
  );
}
