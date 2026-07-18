"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { BottomSheet } from "./BottomSheet";
import { NumericPad } from "./NumericPad";
import { clampNumericValue } from "./numericPadLogic";

/**
 * Stepper +/− avec valeur centrale ouvrant un pavé numérique tactile pour
 * saisir une quantité directement — bornée à [1, max] si max est fourni.
 */
export function QtyStepper({
  qty,
  onChange,
  max,
  big,
}: {
  qty: number;
  onChange: (qty: number) => void;
  max?: number;
  big?: boolean;
}) {
  const [padOpen, setPadOpen] = useState(false);
  const [draft, setDraft] = useState(String(qty));
  const size = big ? 38 : 34;

  function openPad() {
    setDraft(String(qty));
    setPadOpen(true);
  }

  function confirmPad() {
    const clamped = clampNumericValue(draft === "" ? "1" : draft, 1, max);
    onChange(Number(clamped));
    setPadOpen(false);
  }

  return (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", height: size, border: `1.5px solid ${colors.borderField}`, borderRadius: 9, overflow: "hidden" }}>
        <button onClick={() => onChange(Math.max(1, qty - 1))} aria-label="Diminuer" style={stepBtnStyle(size)}>−</button>
        <button onClick={openPad} aria-label="Saisir la quantité" style={{ width: big ? 36 : 38, height: "100%", border: "none", background: "#fff", font: `600 14px ${fonts.ui}`, cursor: "pointer" }}>
          {qty}
        </button>
        <button onClick={() => onChange(max !== undefined ? Math.min(max, qty + 1) : qty + 1)} aria-label="Augmenter" style={stepBtnStyle(size)}>+</button>
      </div>
      <BottomSheet open={padOpen} onClose={() => setPadOpen(false)} title="Quantité">
        <NumericPad value={draft} mode="integer" onChange={setDraft} onConfirm={confirmPad} />
      </BottomSheet>
    </>
  );
}

function stepBtnStyle(w: number): React.CSSProperties {
  return { width: w, height: "100%", border: "none", background: colors.ivory, fontSize: w >= 38 ? 18 : 17, color: colors.primary, cursor: "pointer" };
}
