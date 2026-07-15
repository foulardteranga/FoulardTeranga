"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { SCREEN_META } from "@/lib/nav";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { createClient } from "@/lib/supabase/browser";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import { formatOrderAgo } from "@/lib/data/orderStatus";
import type { NotificationItem } from "@/lib/data/notifications.server";
import type { NotificationType } from "@/lib/generated/prisma/client";

const NOTIF_META: Record<NotificationType, { icon: string; iconColor: string; bg: string }> = {
  nouvelle_commande: { icon: ICONS.orders, iconColor: "#26326B", bg: "#EEF0F7" },
  stock_bas: { icon: ICONS.alertTriangle, iconColor: "#E0A400", bg: "#FBF1D8" },
  paiement_recu: { icon: ICONS.check, iconColor: "#0E9F6E", bg: "#E6F4EE" },
};

export function TopBar({
  initialNotifications,
  tenantId,
}: {
  initialNotifications: NotificationItem[];
  tenantId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [title, sub] = SCREEN_META[pathname] ?? ["Back-office", ""];
  const notifOpen = useBackoffice((s) => s.notifOpen);
  const toggleNotif = useBackoffice((s) => s.toggleNotif);
  const closeNotif = useBackoffice((s) => s.closeNotif);

  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        closeNotif();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notifOpen, closeNotif]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification", filter: `tenantId=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: NotificationType;
            title: string;
            body: string;
            href: string;
            read: boolean;
            createdAt: string;
          };
          setNotifications((prev) => [
            { id: row.id, type: row.type, title: row.title, body: row.body, href: row.href, read: row.read, createdAt: row.createdAt },
            ...prev,
          ]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead();
  }

  async function openNotif(n: NotificationItem) {
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    closeNotif();
    router.push(n.href);
    await markNotificationRead(n.id);
  }

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

      <div ref={notifRef} style={{ position: "relative", flex: "none" }}>
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
          {unreadCount > 0 && (
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
              {unreadCount}
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
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  fontSize: 12,
                  color: unreadCount === 0 ? "#B6AEA1" : colors.primary,
                  fontWeight: 600,
                  cursor: unreadCount === 0 ? "default" : "pointer",
                }}
              >
                Tout marquer lu
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: colors.muted }}>
                  Aucune notification pour l&apos;instant.
                </div>
              ) : (
                notifications.map((n) => {
                  const meta = NOTIF_META[n.type];
                  return (
                    <div
                      key={n.id}
                      onClick={() => openNotif(n)}
                      className="ft-hover-surface"
                      style={{
                        display: "flex",
                        gap: 11,
                        padding: "12px 16px",
                        borderBottom: "1px solid #F1ECE2",
                        cursor: "pointer",
                        opacity: n.read ? 0.55 : 1,
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
                          background: meta.bg,
                        }}
                      >
                        <Icon path={meta.icon} size={17} stroke={meta.iconColor} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.35 }}>
                          {n.body}
                        </div>
                        <div style={{ fontSize: 11, color: "#9a8f7d", marginTop: 3 }}>
                          {formatOrderAgo(new Date(n.createdAt))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
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
