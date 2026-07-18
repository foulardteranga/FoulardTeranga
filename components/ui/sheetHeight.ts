export const SHEET_MIN_VH = 40;
export const SHEET_MAX_VH = 92;
export const SHEET_DEFAULT_VH = 60;

/** Borne une hauteur de sheet (en unités vh) entre un minimum et un maximum. */
export function clampSheetHeight(
  vh: number,
  min: number = SHEET_MIN_VH,
  max: number = SHEET_MAX_VH
): number {
  return Math.min(max, Math.max(min, vh));
}
