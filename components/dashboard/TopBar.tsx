"use client";

import { usePathname } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { SCREEN_META } from "@/lib/nav";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { notifs } from "@/lib/data/notifs";

export function TopBar() {
  const pathname = usePathname();
  const [title, sub] = SCREEN_META[pathname] ?? ["Back-office", ""];
  const notifOpen = useBackoffice((s) => s.notifOpen);
  const notifCount = useBackoffice((s) => s.notifCount);
  const toggleNotif = useBackoffice((s) => s.toggleNotif);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 18px",
        background: "rgba(250,247,242,.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(30,27,24,.08)",
      }}
    >
      <span
        className="ft-mobile-only"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: colors.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 15,
          color: "#fff",
          flex: "none",
        }}
      >
        T
      </span>

      <div
        style={{
          minWidth: 0,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "clamp(18px, 4vw, 22px)",
          }}
        >
          {title}
        </div>
        <div
          className="ft-desktop-only"
          style={{ fontSize: 12.5, color: colors.muted, marginTop: 1 }}
        >
          {sub}
        </div>
      </div>

      <div
        className="ft-desktop-only"
        style={{
          alignItems: "center",
          height: 40,
          padding: "0 12px",
          border: `1.5px solid ${colors.borderField}`,
          borderRadius: 10,
          background: "#fff",
          gap: 9,
          width: 280,
          display: "flex",
        }}
      >
        <Icon path={ICONS.search} size={17} stroke={colors.muted} />
        <input
          placeholder="Rechercher commande, cliente, produit…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            font: `400 14px ${fonts.ui}`,
            color: colors.ink,
            background: "transparent",
          }}
        />
      </div>

      <div style={{ position: "relative", flex: "none" }}>
        <button
          onClick={toggleNotif}
          className="ft-hover-surface"
          aria-label="Notifications"
          style={{
            width: 40,
            height: 40,
            border: `1.5px solid ${colors.borderField}`,
            borderRadius: 10,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <Icon path={ICONS.bell} size={19} stroke={colors.ink} />
          {notifCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                font: `700 10px ${fonts.ui}`,
                background: colors.accent,
                color: "#fff",
                minWidth: 17,
                height: 17,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: "2px solid #FAF7F2",
              }}
            >
              {notifCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            style={{
              position: "absolute",
              top: 48,
              right: 0,
              width: 320,
              background: "#fff",
              border: "1px solid rgba(30,27,24,.1)",
              borderRadius: 14,
              boxShadow: "0 12px 32px rgba(60,40,20,.16)",
              overflow: "hidden",
              zIndex: 40,
              animation: "ft-fade .12s ease",
            }}
          >
            <div
              style={{
                padding: "13px 16px",
                borderBottom: `1px solid ${colors.borderSoft}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
              <span style={{ fontSize: 12, color: colors.primary, fontWeight: 600 }}>
                Tout marquer lu
              </span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {notifs.map((nt, i) => (
                <div
                  key={i}
                  className="ft-hover-surface"
                  style={{
                    display: "flex",
                    gap: 11,
                    padding: "12px 16px",
                    borderBottom: "1px solid #F1ECE2",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: nt.bg,
                    }}
                  >
                    <Icon path={nt.icon} size={17} stroke={nt.iconColor} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                      {nt.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.35 }}>
                      {nt.body}
                    </div>
                    <div style={{ fontSize: 11, color: "#9a8f7d", marginTop: 3 }}>
                      {nt.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <span
        className="ft-desktop-only"
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: colors.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 14,
          color: "#fff",
          flex: "none",
        }}
      >
        AK
      </span>
    </header>
  );
}
