import { ICONS } from "@/components/ui/Icon";
import type { BlockId } from "@/lib/storefront/blockIds";

/**
 * Icône (tracé SVG) par type de bloc — liste de blocs, sélecteur et toolbar
 * de l'éditeur. Ne vit pas dans lib/storefront/blockSettings.ts (module
 * server-safe, cf. l'avertissement en tête de lib/storefront/blockIds.ts) :
 * cette table dépend de components/ui/Icon et reste donc côté éditeur/client.
 */
export const BLOCK_ICONS: Record<BlockId, string> = {
  hero: ICONS.image,
  cats: ICONS.dash,
  grid: ICONS.cart,
  boutique: ICONS.inv,
  loyalty: ICONS.star,
  featured: ICONS.heart,
  story: ICONS.clock,
  look: ICONS.gallery,
  news: ICONS.mail,
  contact: ICONS.mapPin,
};
