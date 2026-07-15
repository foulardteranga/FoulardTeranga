import type { BlockInstance } from "@/lib/storefront/pageContent";
import type { Product } from "@/lib/data/types";
import type {
  HeroSettings, StorySettings, LoyaltySettings, NewsSettings, ContactSettings,
  CatsSettings, GridSettings, FeaturedSettings, LookSettings,
} from "@/lib/storefront/blockSettings";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";
import { FeaturedProductBlock } from "./FeaturedProductBlock";
import { StoryBlock } from "./StoryBlock";
import { LookbookBlock } from "./LookbookBlock";
import { NewsletterBlock } from "./NewsletterBlock";
import { ContactBlock } from "./ContactBlock";

export interface BlockRenderContext {
  products: Product[];
  whatsappPhone?: string | null;
}

/** Mappe un bloc + ses réglages vers son composant, avec narrowing par type. */
export function renderBlock(instance: BlockInstance, ctx: BlockRenderContext): React.ReactNode {
  const { products, whatsappPhone } = ctx;
  switch (instance.type) {
    case "hero":
      return <HeroBlock settings={instance.settings as HeroSettings} />;
    case "cats":
      return <CategoryTilesBlock settings={instance.settings as CatsSettings} products={products} />;
    case "grid":
      return <ProductGridBlock settings={instance.settings as GridSettings} products={products} />;
    case "loyalty":
      return <LoyaltyBannerBlock settings={instance.settings as LoyaltySettings} />;
    case "featured":
      return <FeaturedProductBlock settings={instance.settings as FeaturedSettings} products={products} />;
    case "story":
      return <StoryBlock settings={instance.settings as StorySettings} />;
    case "look":
      return <LookbookBlock settings={instance.settings as LookSettings} />;
    case "news":
      return <NewsletterBlock settings={instance.settings as NewsSettings} />;
    case "contact":
      return <ContactBlock settings={instance.settings as ContactSettings} whatsappPhone={whatsappPhone} />;
    default:
      return null;
  }
}
