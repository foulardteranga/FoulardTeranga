import type { TenantStatus } from "@/lib/generated/prisma/enums";

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
  /**
   * Cycle de vie (spec §9). Porté ici et non dans la session : `lib/auth/session.ts`
   * lit `Tenant` via PostgREST sous le JWT de l'utilisateur, et seul `enabledModules`
   * y est concédé à `authenticated` (migration 20260726155246) — `status` y serait
   * silencieusement vide. Le registry Prisma est la seule voie de lecture.
   */
  status: TenantStatus;
  theme: ThemeTokens;
  /** Hôtes additionnels mappés à ce tenant (domaines custom, alias locaux). */
  domains: string[];
}
