"use client";

import { fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useStorefront, type ToastType } from "@/lib/store/useStorefront";

const META: Record<ToastType, { color: string; icon: string }> = {
  success: { color: "#0E9F6E", icon: ICONS.check },
  warning: { color: "#E0A400", icon: ICONS.alertTriangle },
  error: { color: "#C4453B", icon: ICONS.close },
};

export function StoreToast() {
  const toast = useStorefront((s) => s.toast);
  if (!toast) return null;
  const meta = META[toast.type];

  return (
    <div
      role="status"
      className="ft-store-toast"
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)", zIndex: 90,
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", border: "1px solid #EAE4D9", borderLeft: `4px solid ${meta.color}`, borderRadius: 12,
        padding: "14px 16px", boxShadow: "0 8px 24px rgba(60,40,20,.16)", maxWidth: "90vw",
        animation: "ft-fade .18s ease",
      }}
    >
      <Icon path={meta.icon} size={20} stroke={meta.color} strokeWidth={2} />
      <div style={{ font: `600 14px ${fonts.ui}` }}>{toast.msg}</div>
    </div>
  );
}
