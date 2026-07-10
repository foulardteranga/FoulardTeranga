import type { ComponentType } from "react";
import type { BlockId } from "@/lib/store/useStorefront";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";
import { FeaturedProductBlock } from "./FeaturedProductBlock";
import { StoryBlock } from "./StoryBlock";
import { LookbookBlock } from "./LookbookBlock";
import { NewsletterBlock } from "./NewsletterBlock";
import { ContactBlock } from "./ContactBlock";

/**
 * type → composant de rendu. Chaque bloc ajouté ici devient immédiatement
 * disponible sur la Home, réordonnable/masquable en mode éditeur — préfigure
 * le futur éditeur de vitrine complet (SECTIONS.md §1).
 */
export const blockRegistry: Partial<Record<BlockId, ComponentType>> = {
  hero: HeroBlock,
  cats: CategoryTilesBlock,
  grid: ProductGridBlock,
  loyalty: LoyaltyBannerBlock,
  featured: FeaturedProductBlock,
  story: StoryBlock,
  look: LookbookBlock,
  news: NewsletterBlock,
  contact: ContactBlock,
};
