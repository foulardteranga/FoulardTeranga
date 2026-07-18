import type { CSSProperties } from "react";

/**
 * Icône ligne 24×24 (style Lucide, stroke 1.75, extrémités arrondies) — voir
 * DESIGN.md §4. Reproduit le helper `icon()` du prototype : on passe le contenu
 * du SVG (paths) et on contrôle taille / couleur / épaisseur.
 */
export function Icon({
  path,
  size = 18,
  stroke = "currentColor",
  strokeWidth = 1.75,
  fill = "none",
  style,
}: {
  path: string;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

/** Répertoire des tracés d'icônes utilisés dans le back-office. */
export const ICONS = {
  pos: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  dash: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  inv: '<path d="M12.2 3.3a2 2 0 0 0-.4 0l-7 3.9V17l7.2 4 7.2-4V7.2Z"/><path d="m4.5 7 7.5 4 7.5-4M12 21v-10"/>',
  orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  cust: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3.5 3.5 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>',
  mkt: '<path d="M3 11v3a1 1 0 0 0 1 1h3l4 4V7L7 11H4a1 1 0 0 0-1 0Z"/><path d="M16 8a5 5 0 0 1 0 8"/>',
  fin: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  theme: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 2-2 2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 10 10 0 0 0-9-9Z"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-1 4M20 5v6h-6"/>',
  wifiOff: '<path d="M1 1l22 22M16.7 16.7A9 9 0 0 1 12 18M5 12.5a10 10 0 0 1 3-2M8.5 8.5A15 15 0 0 1 20 12M2 9a15 15 0 0 1 4.3-2.6M12 21h.01"/>',
  alertTriangle: '<path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  clipboardCheck: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12.5a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.6L22 7H6"/>',
  heart: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 21.5 12c-2.5 4.5-9.5 9-9.5 9Z"/>',
  personPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M19 8v6M22 11h-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  infoAlt: '<path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  phone: '<path d="M21 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.9 4.2 2 2 0 0 1 3.9 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-4.9a8.5 8.5 0 1 1 16-3.6Z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  trendUp: '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 5-6"/>',
  arrowUpRight: '<path d="M7 17 17 7M17 7H8M17 7v9"/>',
  arrowDownRight: '<path d="M17 7 7 17M7 17h9M7 17V8"/>',
  star: '<path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z"/>',
  clock: '<path d="M12 22a10 10 0 1 1 0-20M12 12l4-2M12 6v6"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  mobileMoney: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  mixte: '<path d="M8 3H4v4M16 21h4v-4M4 7l16 10M20 7 4 17"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
  gallery: '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m4 6 8 7 8-7"/>',
  duplicate: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s4-7 10-7c1.4 0 2.7.3 3.9.8M22 12s-1.4 2.4-3.7 4.4M9.9 9.9a3 3 0 0 0 4.2 4.2M1 1l22 22"/>',
  keypad: '<circle cx="6" cy="6" r="1.3"/><circle cx="12" cy="6" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/><circle cx="6" cy="18" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="18" cy="18" r="1.3"/>',
} as const;
