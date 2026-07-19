import { describe, it, expect } from "vitest";
import { clampSheetHeight, SHEET_MIN_VH, SHEET_MAX_VH } from "./sheetHeight";

describe("clampSheetHeight", () => {
  it("laisse passer une valeur dans les bornes", () => {
    expect(clampSheetHeight(60)).toBe(60);
  });

  it("borne au minimum par défaut", () => {
    expect(clampSheetHeight(10)).toBe(SHEET_MIN_VH);
  });

  it("borne au maximum par défaut", () => {
    expect(clampSheetHeight(150)).toBe(SHEET_MAX_VH);
  });

  it("accepte des bornes personnalisées", () => {
    expect(clampSheetHeight(5, 20, 80)).toBe(20);
    expect(clampSheetHeight(95, 20, 80)).toBe(80);
  });
});
