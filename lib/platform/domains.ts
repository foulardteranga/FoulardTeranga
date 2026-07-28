/**
 * Normalise un hôte saisi à la main pour qu'il corresponde exactement à ce que
 * `resolveTenantFromHost` compare : minuscules, sans schéma, sans port, sans
 * chemin, sans point final.
 */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");
}

const LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const DOMAIN_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`);

export function isValidDomain(host: string): boolean {
  return host.length > 0 && host.length <= 253 && DOMAIN_RE.test(host);
}

/**
 * Découpe une saisie libre (une entrée par ligne ou séparées par des virgules),
 * normalise chaque entrée, dédoublonne, et refuse à la première entrée invalide
 * en la nommant — un domaine silencieusement ignoré serait pire qu'un refus.
 */
export function parseDomains(
  raw: string
): { ok: true; domains: string[] } | { ok: false; error: string } {
  const parts = raw
    .split(/[\n,]/)
    .map(normalizeDomain)
    .filter((d) => d.length > 0);

  const seen = new Set<string>();
  const domains: string[] = [];
  for (const domain of parts) {
    if (!isValidDomain(domain)) {
      return { ok: false, error: `Domaine invalide : « ${domain} ».` };
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }
  return { ok: true, domains };
}
