/**
 * Tokens de couleur & typographie — "Teranga Moderne" (voir DESIGN.md).
 * Exposés en constantes TypeScript pour un usage direct dans les styles inline
 * des composants back-office, en miroir des variables CSS de globals.css.
 */
export const colors = {
  ivory: "#FAF7F2",
  surface: "#FFFFFF",
  ink: "#1E1B18",
  muted: "#6B6259",
  primary: "#26326B",
  primaryHover: "#1C2652",
  accent: "#D07A34",
  accentHover: "#BD6B28",
  sable: "#E7DECF",
  gold: "#C9A227",
  page: "#E3DCD0",

  success: "#0E9F6E",
  warning: "#E0A400",
  danger: "#C4453B",
  dangerHover: "#A83A31",

  bgSuccess: "#E6F4EE",
  fgSuccess: "#0b6e4d",
  bgWarning: "#FBF1D8",
  fgWarning: "#8a6500",
  bgDanger: "#F8E5E3",
  fgDanger: "#9c352d",
  bgInfo: "#EEF0F7",
  fgInfo: "#26326B",

  borderHair: "rgba(30,27,24,.08)",
  borderSoft: "#EAE4D9",
  borderField: "#DAD3C7",
  rowAlt: "#FDFCFA",
  faintLine: "#F4EFE6",

  navIdle: "#C9BEB0",
  navSub: "#8f857a",
  disabled: "#C7C1B6",
} as const;

export const fonts = {
  display: "var(--font-display)",
  ui: "var(--font-ui)",
} as const;

/** Bordure fine préférée aux ombres en mode admin (règle DESIGN.md §3). */
export const adminBorder = `1px solid ${colors.borderHair}`;

/** Convertit un hex en rgba (pour dégradés de thème). */
export function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
