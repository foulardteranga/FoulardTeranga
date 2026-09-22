/**
 * Utilitaires mathématiques de conversion et de génération de nuances de couleur en HSL.
 * 100% autonome, exécutable en environnement Node.js et Browser sans dépendance tierce.
 */

export interface HslColor {
  h: number; // [0, 360)
  s: number; // [0, 100]
  l: number; // [0, 100]
}

export type ShadeRole = "ref" | "light" | "dark" | "vivid" | "soft";

export interface ShadeOption {
  label: string;
  name: string;
  hex: string;
  role: ShadeRole;
}

export function hexToHsl(hex: string): HslColor {
  let cleaned = hex.replace(/^#/, "").trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  const num = parseInt(cleaned, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let l = (max + min) / 2;
  let s = 0;
  let h = 0;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / delta + 2) * 60;
    } else {
      h = ((r - g) / delta + 4) * 60;
    }
  }

  return {
    h: (h + 360) % 360,
    s: s * 100,
    l: l * 100,
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const normH = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lum = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = lum - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (normH < 60) {
    rPrime = c;
    gPrime = x;
    bPrime = 0;
  } else if (normH < 120) {
    rPrime = x;
    gPrime = c;
    bPrime = 0;
  } else if (normH < 180) {
    rPrime = 0;
    gPrime = c;
    bPrime = x;
  } else if (normH < 240) {
    rPrime = 0;
    gPrime = x;
    bPrime = c;
  } else if (normH < 300) {
    rPrime = x;
    gPrime = 0;
    bPrime = c;
  } else {
    rPrime = c;
    gPrime = 0;
    bPrime = x;
  }

  const r = Math.max(0, Math.min(255, Math.round((rPrime + m) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((gPrime + m) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((bPrime + m) * 255)));

  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Génère 5 nuances complémentaires à partir d'une couleur de référence.
 */
export function generateShades(baseHex: string, baseName: string): ShadeOption[] {
  const hsl = hexToHsl(baseHex);

  // 1. Référence exacte
  const ref: ShadeOption = {
    role: "ref",
    label: `${baseName} (Original)`,
    name: baseName,
    hex: baseHex.toLowerCase(),
  };

  // 2. Plus claire : luminosité +14%, saturation légèrement ajustée
  const lightL = Math.min(92, hsl.l + 14);
  const lightS = Math.max(15, hsl.s - 4);
  const light: ShadeOption = {
    role: "light",
    label: `${baseName} clair`,
    name: `${baseName} clair`,
    hex: hslToHex(hsl.h, lightS, lightL),
  };

  // 3. Plus sombre : luminosité -14%, saturation +4%
  const darkL = Math.max(12, hsl.l - 14);
  const darkS = Math.min(100, hsl.s + 4);
  const dark: ShadeOption = {
    role: "dark",
    label: `${baseName} foncé`,
    name: `${baseName} foncé`,
    hex: hslToHex(hsl.h, darkS, darkL),
  };

  // 4. Plus vive / éclatante : saturation +22%
  const vividS = Math.min(100, hsl.s + 22);
  const vivid: ShadeOption = {
    role: "vivid",
    label: `${baseName} vif`,
    name: `${baseName} vif`,
    hex: hslToHex(hsl.h, vividS, hsl.l),
  };

  // 5. Adoucie / poudrée : saturation -26%, luminosité +6%
  const softS = Math.max(15, hsl.s - 26);
  const softL = Math.min(88, hsl.l + 6);
  const soft: ShadeOption = {
    role: "soft",
    label: `${baseName} poudré`,
    name: `${baseName} poudré`,
    hex: hslToHex(hsl.h, softS, softL),
  };

  return [ref, light, dark, vivid, soft];
}
