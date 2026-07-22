export interface ThemeTokens {
  primaryColor: string;
  accentColor: string;
  logoText: string;
}

export interface Tenant {
  id: string;
  /** Sous-domaine canonique (ex. "foulard-teranga" → foulard-teranga.plateforme.app). */
  slug: string;
  name: string;
  theme: ThemeTokens;
  /** Hôtes additionnels mappés à ce tenant (domaines custom, alias locaux). */
  domains: string[];
}
