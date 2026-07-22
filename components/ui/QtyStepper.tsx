"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { BottomSheet } from "./BottomSheet";
import { NumericPad } from "./NumericPad";
import { clampNumericValue } from "./numericPadLogic";

type QtyStepperSize = "sm" | "md" | "lg";

const SIZE_DIMENSIONS: Record<QtyStepperSize, { box: number; btnWidth: number; btnFontSize: number; centerWidth: number; centerFontSize: number }> = {
  sm: { box: 34, btnWidth: 34, btnFontSize: 17, centerWidth: 38, centerFontSize: 14 },
  md: { box: 38, btnWidth: 38, btnFontSize: 17, centerWidth: 38, centerFontSize: 14 },
  lg: { box: 50, btnWidth: 46, btnFontSize: 20, centerWidth: 48, centerFontSize: 16 },
};

/**
 * Stepper +/− avec valeur centrale ouvrant un pavé numérique tactile pour
 * saisir une quantité directement — bornée à [1, max] si max est fourni.
 */
export function QtyStepper({
  qty,
  onChange,
  max,
  size = "sm",
}: {
  qty: number;
  onChange: (qty: number) => void;
  max?: number;
  size?: QtyStepperSize;
}) {
  const [padOpen, setPadOpen] = useState(false);
  const [draft, setDraft] = useState(String(qty));
  const dim = SIZE_DIMENSIONS[size];

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
      <div style={{ display: "inline-flex", alignItems: "center", height: dim.box, border: `1.5px solid ${colors.borderField}`, borderRadius: 9, overflow: "hidden" }}>
        <button onClick={() => onChange(Math.max(1, qty - 1))} aria-label="Diminuer" style={stepBtnStyle(dim.btnWidth, dim.btnFontSize)}>−</button>
        <button onClick={openPad} aria-label="Saisir la quantité" style={{ width: dim.centerWidth, height: "100%", border: "none", background: "#fff", font: `600 ${dim.centerFontSize}px ${fonts.ui}`, cursor: "pointer" }}>
          {qty}
        </button>
        <button onClick={() => onChange(max !== undefined ? Math.min(max, qty + 1) : qty + 1)} aria-label="Augmenter" style={stepBtnStyle(dim.btnWidth, dim.btnFontSize)}>+</button>
      </div>
      <BottomSheet open={padOpen} onClose={() => setPadOpen(false)} title="Quantité">
        <NumericPad value={draft} mode="integer" onChange={setDraft} onConfirm={confirmPad} />
      </BottomSheet>
    </>
  );
}

function stepBtnStyle(w: number, fontSize: number): React.CSSProperties {
  return { width: w, height: "100%", border: "none", background: colors.ivory, fontSize, color: colors.primary, cursor: "pointer" };
}
