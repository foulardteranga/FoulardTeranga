"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { appendDigit, appendDoubleZero, deleteLast, formatPadValue, type NumericMode } from "./numericPadLogic";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Pavé numérique tactile — grille 3×4, touche contextuelle selon le mode
 * (« 00 » en mode montant, « + » en mode téléphone, « . » en mode décimal),
 * valeur formatée en direct (groupement de milliers en mode montant).
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

  function press(key: string) {
    if (key === "00") onChange(appendDoubleZero(value));
    else onChange(appendDigit(value, key, mode));
  }

  return (
    <div style={{ padding: "8px 18px 18px" }}>
      <div
        style={{
          height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end",
          padding: "0 4px", marginBottom: 14, fontFamily: fonts.display, fontWeight: 600, fontSize: 26,
          borderBottom: `1.5px solid ${colors.borderSoft}`, color: value ? colors.ink : colors.muted,
        }}
      >
        {value ? formatPadValue(value, mode) : "0"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
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
        height: 56, border: `1.5px solid ${colors.borderSoft}`, borderRadius: 12,
        background: "#fff", color: muted ? colors.muted : colors.ink,
        font: `700 20px ${fonts.ui}`, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const confirmBtn: React.CSSProperties = {
  width: "100%", height: 56, border: "none", borderRadius: 10,
  background: colors.primary, color: "#fff", font: `700 14px ${fonts.ui}`, cursor: "pointer",
};
