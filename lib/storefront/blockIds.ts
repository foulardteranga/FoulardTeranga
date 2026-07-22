/**
 * Identifiants de blocs de la vitrine + ordre/noms par défaut.
 *
 * Module serveur-safe (pas de "use client") : `lib/storefront/pageContent.ts`
 * (consommé côté serveur par `lib/data/storefrontPage.server.ts`) en a besoin
 * à l'exécution. Ne pas ré-importer ces valeurs depuis `lib/store/useStorefront`
 * (qui est un module client) — Next.js remplace les exports d'un module
 * "use client" par des références client lors du bundling serveur, ce qui
 * casse tout usage de valeur (ex. `new Set(DEFAULT_BLOCK_ORDER)`) hors composant.
 */
export type BlockId =
  | "hero"
  | "cats"
  | "grid"
  | "boutique"
  | "loyalty"
  | "featured"
  | "story"
  | "look"
  | "news"
  | "contact";

export const DEFAULT_BLOCK_ORDER: BlockId[] = [
  "hero", "cats", "grid", "boutique", "loyalty", "featured", "story", "look", "news", "contact",
];

export const DEFAULT_BLOCK_NAMES: Record<BlockId, string> = {
  hero: "Bandeau Hero",
  cats: "Vignettes catégories",
  grid: "Nouveautés & best-sellers",
  boutique: "Bandeau boutique",
  loyalty: "Bandeau fidélité",
  featured: "Produit vedette",
  story: "Notre histoire",
  look: "Galerie / Lookbook",
  news: "Newsletter",
  contact: "Contact & localisation",
};
