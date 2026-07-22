export interface Country {
  name: string;
  dial: string;
}

/** Pays desservis en priorité (Afrique de l'Ouest) — la boutique reçoit des commandes de toute la sous-région. */
export const COUNTRIES: Country[] = [
  { name: "Côte d'Ivoire", dial: "+225" },
  { name: "Sénégal", dial: "+221" },
  { name: "Burkina Faso", dial: "+226" },
  { name: "Mali", dial: "+223" },
  { name: "Guinée", dial: "+224" },
  { name: "Bénin", dial: "+229" },
  { name: "Togo", dial: "+228" },
  { name: "Niger", dial: "+227" },
  { name: "Ghana", dial: "+233" },
];

/** Retire un indicatif déjà présent en tête du numéro ("+225 07…" → "07…"). */
function stripDialPrefix(phone: string): string {
  return phone.replace(/^\s*\+\d{1,4}\s*/, "").trim();
}

/** Réapplique l'indicatif du pays choisi, en conservant les chiffres déjà saisis. */
export function applyCountryDial(phone: string, dial: string): string {
  const rest = stripDialPrefix(phone);
  return rest ? `${dial} ${rest}` : `${dial} `;
}
