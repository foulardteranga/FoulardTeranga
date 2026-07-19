"use client";

import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";

/** Barre d'actions flottante affichée sur le bloc sélectionné du canevas. */
export function BlockCanvasToolbar({
  visible,
  canRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleVisible,
  onRemove,
}: {
  visible: boolean;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleRemoveClick() {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    onRemove();
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        // z-index au-dessus de la barre d'actions sticky (zIndex 20 dans VitrineEditor) :
        // le haut du canevas peut coïncider avec la bande occupée par cette barre
        // (le premier bloc est sélectionné par défaut, non scrollé) — sans cela la
        // toolbar serait peinte dessous et donc invisible/non cliquable.
        position: "absolute", top: 8, right: 8, zIndex: 25,
        display: "flex", gap: 4, padding: 4, background: "#fff", borderRadius: 10,
        border: `1px solid ${colors.borderSoft}`, boxShadow: "0 4px 14px rgba(60,40,20,.14)",
      }}
    >
      <ToolbarBtn label="Monter" onClick={onMoveUp}>
        <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
          <Icon path={ICONS.chevronDown} size={17} stroke={colors.primary} strokeWidth={2} />
        </span>
      </ToolbarBtn>
      <ToolbarBtn label="Descendre" onClick={onMoveDown}>
        <Icon path={ICONS.chevronDown} size={17} stroke={colors.primary} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn label="Dupliquer" onClick={onDuplicate}>
        <Icon path={ICONS.duplicate} size={17} stroke={colors.primary} strokeWidth={1.7} />
      </ToolbarBtn>
      <ToolbarBtn label={visible ? "Masquer" : "Afficher"} onClick={onToggleVisible}>
        <Icon path={visible ? ICONS.eye : ICONS.eyeOff} size={17} stroke={colors.primary} strokeWidth={1.7} />
      </ToolbarBtn>
      <ToolbarBtn
        label={confirming ? "Confirmer ?" : "Supprimer"}
        onClick={handleRemoveClick}
        disabled={!canRemove}
        danger={confirming}
        wide={confirming}
      >
        {confirming ? undefined : <Icon path={ICONS.close} size={17} stroke={colors.danger} strokeWidth={2} />}
      </ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  disabled,
  danger,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Impossible de supprimer le dernier bloc" : label}
      aria-label={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        width: wide ? "auto" : 40, height: 40, padding: wide ? "0 12px" : 0,
        border: "none", borderRadius: 8, cursor: disabled ? "default" : "pointer",
        background: danger ? colors.danger : "transparent",
        color: danger ? "#fff" : colors.primary,
        opacity: disabled ? 0.35 : 1,
        font: wide ? `600 12px ${fonts.ui}` : undefined,
      }}
    >
      {children ?? label}
    </button>
  );
}
