import { fmt } from "@/lib/format";

export type NumericMode = "integer" | "money" | "decimal" | "phone";

/** Ajoute un caractère à la valeur en cours, en respectant les règles du
 *  mode. Retourne la valeur inchangée si le caractère n'est pas autorisé. */
export function appendDigit(value: string, digit: string, mode: NumericMode): string {
  if (mode === "phone") {
    if (digit === "+") return value.includes("+") ? value : "+" + value;
    if (!/^[0-9]$/.test(digit)) return value;
    return value + digit;
  }
  if (digit === ".") {
    if (mode !== "decimal" || value.includes(".")) return value;
    return value === "" ? "0." : value + ".";
  }
  if (!/^[0-9]$/.test(digit)) return value;
  // évite les zéros non significatifs ("0" + "5" -> "5", pas "05")
  if (value === "0") return digit;
  return value + digit;
}

/** Ajoute « 00 » en un tap (touche contextuelle du mode montant). */
export function appendDoubleZero(value: string): string {
  if (value === "" || value === "0") return "0";
  return value + "00";
}

/** Retire le dernier caractère saisi. */
export function deleteLast(value: string): string {
  return value.slice(0, -1);
}

/** Borne une valeur numérique entre min et max, une fois confirmée par l'utilisateur. */
export function clampNumericValue(value: string, min?: number, max?: number): string {
  if (value === "" || value === ".") return value;
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  let clamped = n;
  if (min !== undefined) clamped = Math.max(min, clamped);
  if (max !== undefined) clamped = Math.min(max, clamped);
  return String(clamped);
}

/** Formate la valeur en cours pour l'affichage du pavé (groupement de milliers en mode montant). */
export function formatPadValue(value: string, mode: NumericMode): string {
  if (mode === "money" && value !== "" && value !== "0") {
    const n = Number(value);
    return Number.isNaN(n) ? value : `${fmt(n)} FCFA`;
  }
  return value;
}
