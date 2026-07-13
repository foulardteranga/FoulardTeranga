"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice, type ToastType } from "@/lib/store/useBackoffice";

const META: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: colors.success, icon: ICONS.check },
  warning: { bg: colors.warning, icon: ICONS.info },
  error: { bg: colors.danger, icon: ICONS.close },
};

export function Toast() {
  const toast = useBackoffice((s) => s.toast);
  if (!toast) return null;
  const meta = META[toast.type];

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        background: meta.bg,
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 12,
        boxShadow: "0 8px 28px rgba(30,27,24,.28)",
        font: `600 14px ${fonts.ui}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation: "ft-fade .18s ease",
        maxWidth: "92vw",
      }}
    >
      <Icon path={meta.icon} size={16} stroke="#fff" strokeWidth={2} />
      {toast.msg}
    </div>
  );
}
