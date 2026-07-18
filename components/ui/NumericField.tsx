"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BottomSheet } from "./BottomSheet";
import { NumericPad } from "./NumericPad";
import { useCoarsePointer } from "./useCoarsePointer";
import { clampNumericValue, type NumericMode } from "./numericPadLogic";

const NATIVE_TYPE: Record<NumericMode, "number" | "tel"> = {
  integer: "number", money: "number", decimal: "number", phone: "tel",
};
const INPUT_MODE: Record<NumericMode, "numeric" | "decimal" | "tel"> = {
  integer: "numeric", money: "numeric", decimal: "decimal", phone: "tel",
};

/**
 * Champ numérique adaptatif : sur pointeur tactile, le champ passe en lecture
 * seule et un tap ouvre un pavé numérique en bottom-sheet ; au clavier/souris,
 * saisie native inchangée (type number/tel — même contrôle natif qu'avant,
 * zéro régression), avec une icône pour ouvrir le pavé si on préfère.
 */
export function NumericField({
  mode,
  value,
  onChange,
  label,
  placeholder,
  min,
  max,
  invalid,
}: {
  mode: NumericMode;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  const coarse = useCoarsePointer();
  const [padOpen, setPadOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function openPad() {
    setDraft(value);
    setPadOpen(true);
  }

  function confirmPad() {
    onChange(mode === "phone" ? draft : clampNumericValue(draft, min, max));
    setPadOpen(false);
  }

  const baseStyle: React.CSSProperties = {
    width: "100%", height: 44, padding: "0 13px",
    border: `1.5px solid ${invalid ? colors.danger : colors.borderField}`,
    borderRadius: 10, font: `400 14px ${fonts.ui}`, color: colors.ink, outline: "none",
  };

  return (
    <div>
      {label && (
        <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
          {label}
        </label>
      )}
      {coarse ? (
        <input
          value={value}
          readOnly
          onClick={openPad}
          inputMode="none"
          placeholder={placeholder}
          style={{ ...baseStyle, cursor: "pointer" }}
        />
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type={NATIVE_TYPE[mode]}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode={INPUT_MODE[mode]}
            placeholder={placeholder}
            style={{ ...baseStyle, flex: 1 }}
          />
          <button type="button" onClick={openPad} aria-label="Ouvrir le pavé numérique" style={padIconBtn}>
            <Icon path={ICONS.keypad} size={16} stroke={colors.primary} />
          </button>
        </div>
      )}
      <BottomSheet open={padOpen} onClose={() => setPadOpen(false)} title={label ?? "Saisie"}>
        <NumericPad value={draft} mode={mode} onChange={setDraft} onConfirm={confirmPad} />
      </BottomSheet>
    </div>
  );
}

const padIconBtn: React.CSSProperties = {
  width: 36, height: 44, flex: "none", border: `1.5px solid ${colors.borderField}`, borderRadius: 10,
  background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};
