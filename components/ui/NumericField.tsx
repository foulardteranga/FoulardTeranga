"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BottomSheet } from "./BottomSheet";
import { NumericPad } from "./NumericPad";
import { clampNumericValue, formatPadValue, type NumericMode } from "./numericPadLogic";

/**
 * Champ numérique tactile et unifié :
 * Un clic / tap n'importe où sur l'entrée ouvre le pavé numérique (BottomSheet / DigitalPad).
 * L'entrée affiche la valeur formatée (ex. « 15 000 FCFA » ou « 10 ») avec une icône de pavé intégrée.
 * Fonctionne parfaitement sur mobile, tablette et desktop.
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

  const formattedDisplay = value
    ? mode === "money"
      ? formatPadValue(value, "money")
      : value
    : "";

  return (
    <div>
      {label && (
        <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
          {label}
        </label>
      )}

      {/* Saisie unifiée : tap/clic ouvre directement le pavé numérique */}
      <div
        role="button"
        tabIndex={0}
        onClick={openPad}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPad();
          }
        }}
        title={`Cliquer pour saisir ${label ? label.toLowerCase() : "une valeur"}`}
        aria-label={label ?? "Saisie numérique"}
        style={{
          width: "100%",
          height: 44,
          padding: "0 10px 0 13px",
          border: `1.5px solid ${invalid ? colors.danger : colors.borderField}`,
          borderRadius: 10,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
          transition: "border-color .15s ease, box-shadow .15s ease",
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = colors.primary;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.bgInfo}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = invalid ? colors.danger : colors.borderField;
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <span
          style={{
            flex: 1,
            font: `600 14px ${fonts.ui}`,
            color: value ? colors.ink : colors.muted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {formattedDisplay || placeholder || "0"}
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 7,
            background: colors.ivory,
            color: colors.primary,
            flex: "none",
            marginLeft: 8,
          }}
        >
          <Icon path={ICONS.keypad} size={15} stroke="currentColor" />
        </span>
      </div>

      <BottomSheet
        open={padOpen}
        onClose={() => setPadOpen(false)}
        title={label ?? (mode === "money" ? "Saisir le montant" : mode === "phone" ? "Saisir le numéro" : "Saisir la quantité")}
      >
        <NumericPad value={draft} mode={mode} onChange={setDraft} onConfirm={confirmPad} />
      </BottomSheet>
    </div>
  );
}
