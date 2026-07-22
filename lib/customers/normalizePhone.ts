/**
 * Normalise un numéro de téléphone saisi en format libre (KYC, lib/validators/kyc.ts)
 * pour permettre une comparaison fiable entre deux commandes de la même personne.
 * Conserve un éventuel `+` de tête, retire tout le reste sauf les chiffres.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasLeadingPlus ? `+${digits}` : digits;
}
