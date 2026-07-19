"use client";

import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { clampSheetHeight, SHEET_DEFAULT_VH } from "./sheetHeight";

/**
 * Feuille glissante générique (overlay + panneau bas d'écran), poignée
 * redimensionnable au doigt/souris. Ne connaît rien des blocs de la vitrine —
 * réutilisée telle quelle par le futur pavé numérique (chantier 4).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [heightVh, setHeightVh] = useState(SHEET_DEFAULT_VH);
  const dragStart = useRef<{ y: number; heightVh: number } | null>(null);

  useEffect(() => {
    if (open) setHeightVh(SHEET_DEFAULT_VH);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMove(e: PointerEvent) {
      if (!dragStart.current) return;
      const deltaVh = ((dragStart.current.y - e.clientY) / window.innerHeight) * 100;
      setHeightVh(clampSheetHeight(dragStart.current.heightVh + deltaVh));
    }
    function onUp() {
      dragStart.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 60, animation: "ft-fade .15s ease" }}
      />
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61,
          height: `${heightVh}vh`, maxHeight: "92vh",
          background: "#fff", borderRadius: "18px 18px 0 0",
          boxShadow: "0 -8px 32px rgba(60,40,20,.18)",
          display: "flex", flexDirection: "column",
          animation: "ft-slideup .2s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div
          onPointerDown={(e) => { dragStart.current = { y: e.clientY, heightVh }; }}
          style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center", cursor: "ns-resize", touchAction: "none" }}
        >
          <span style={{ width: 40, height: 4, borderRadius: 999, background: colors.borderField }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 18px 12px", borderBottom: `1px solid ${colors.borderSoft}` }}>
          <span style={{ flex: 1, fontFamily: fonts.display, fontWeight: 600, fontSize: 16 }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: "none", background: colors.borderSoft, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Icon path={ICONS.close} size={15} stroke={colors.muted} strokeWidth={2} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
    </>
  );
}
