"use client";

import { useEffect, useCallback } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { appendDigit, appendDoubleZero, deleteLast, formatPadValue, type NumericMode } from "./numericPadLogic";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Pavé numérique tactile — grille 3×4, touche contextuelle selon le mode
 * (« 00 » en mode montant, « + » en mode téléphone, « . » en mode décimal),
 * valeur formatée en direct (groupement de milliers en mode montant).
 * Supporte le tactile ainsi que le clavier physique (0-9, Backspace, Entrée).
 */
export function NumericPad({
  value,
  mode,
  onChange,
  onConfirm,
}: {
  value: string;
  mode: NumericMode;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const contextKey = mode === "money" ? "00" : mode === "phone" ? "+" : mode === "decimal" ? "." : null;

  const press = useCallback(
    (key: string) => {
      if (key === "00") onChange(appendDoubleZero(value));
      else onChange(appendDigit(value, key, mode));
    },
    [value, mode, onChange]
  );

  // Écoute du clavier physique (desktop, laptop, tablette avec clavier)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onChange(deleteLast(value));
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "+" && mode === "phone") {
        e.preventDefault();
        press("+");
      } else if ((e.key === "." || e.key === ",") && mode === "decimal") {
        e.preventDefault();
        press(".");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [press, value, mode, onConfirm, onChange]);

  return (
    <div style={{ padding: "6px 16px 16px" }}>
      <div
        style={{
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 6px",
          marginBottom: 10,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 26,
          borderBottom: `1.5px solid ${colors.borderSoft}`,
          color: value ? colors.ink : colors.muted,
        }}
      >
        {value ? formatPadValue(value, mode) : "0"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginBottom: 10 }}>
        {DIGIT_KEYS.map((k) => (
          <PadKey key={k} label={k} onClick={() => press(k)} />
        ))}
        {contextKey ? <PadKey label={contextKey} onClick={() => press(contextKey)} /> : <span aria-hidden />}
        <PadKey label="0" onClick={() => press("0")} />
        <PadKey label="⌫" onClick={() => onChange(deleteLast(value))} muted />
      </div>
      <button type="button" onClick={onConfirm} style={confirmBtn}>Valider</button>
    </div>
  );
}

function PadKey({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 50,
        border: `1.5px solid ${colors.borderSoft}`,
        borderRadius: 11,
        background: "#fff",
        color: muted ? colors.muted : colors.ink,
        font: `700 20px ${fonts.ui}`,
        cursor: "pointer",
        userSelect: "none",
        transition: "all .1s ease",
      }}
    >
      {label}
    </button>
  );
}

const confirmBtn: React.CSSProperties = {
  width: "100%",
  height: 50,
  border: "none",
  borderRadius: 11,
  background: colors.primary,
  color: "#fff",
  font: `700 15px ${fonts.ui}`,
  cursor: "pointer",
  userSelect: "none",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};
