"use client";

import { colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";

export function OfflineBanner() {
  const offline = useBackoffice((s) => s.offline);
  const queued = useBackoffice((s) => s.queued);
  if (!offline) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 18px",
        background: colors.bgWarning,
        borderBottom: "1px solid #ecdcae",
        color: colors.fgWarning,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <Icon path={ICONS.wifiOff} size={17} stroke={colors.warning} strokeWidth={1.9} />
      Mode hors-ligne — les ventes sont mises en file et seront resynchronisées
      automatiquement.{" "}
      {queued > 0 && (
        <span style={{ fontWeight: 700 }}>{queued} vente(s) en file.</span>
      )}
    </div>
  );
}
