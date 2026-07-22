"use client";

import { colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";

export function StoreOfflineBanner() {
  const offline = useStorefront((s) => s.offline);
  if (!offline) return null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
        background: colors.ink, color: "#fff", fontSize: 13, fontWeight: 500,
        position: "sticky", top: 0, zIndex: 60,
      }}
    >
      <Icon path={ICONS.wifiOff} size={18} stroke={colors.gold} strokeWidth={1.8} />
      <span style={{ flex: 1 }}>
        Hors-ligne — catalogue &amp; panier consultables. Votre demande partira au retour du réseau.
      </span>
    </div>
  );
}
