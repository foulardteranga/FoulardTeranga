/** Formatage des montants en FCFA (interface FR). */
export function fmt(n: number): string {
  // Espaces fines insécables → espaces normales pour un rendu homogène.
  return n.toLocaleString("fr-FR").replace(/ /g, " ");
}

export function money(n: number): string {
  return `${fmt(n)} FCFA`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
