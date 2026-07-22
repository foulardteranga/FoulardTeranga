import type { BlockInstance } from "@/lib/storefront/pageContent";
import type { Product } from "@/lib/data/types";
import type {
  HeroSettings, StorySettings, LoyaltySettings, NewsSettings, ContactSettings,
  CatsSettings, GridSettings, FeaturedSettings, LookSettings, BoutiqueSettings,
} from "@/lib/storefront/blockSettings";
import { HeroBlock } from "./HeroBlock";
import { CategoryTilesBlock } from "./CategoryTilesBlock";
import { ProductGridBlock } from "./ProductGridBlock";
import { BoutiqueBlock } from "./BoutiqueBlock";
import { LoyaltyBannerBlock } from "./LoyaltyBannerBlock";
import { FeaturedProductBlock } from "./FeaturedProductBlock";
import { StoryBlock } from "./StoryBlock";
import { LookbookBlock } from "./LookbookBlock";
import { NewsletterBlock } from "./NewsletterBlock";
import { ContactBlock } from "./ContactBlock";

export interface BlockRenderContext {
  products: Product[];
  whatsappPhone?: string | null;
  /** Pose l'ancre DOM (#ft-story / #ft-contact). Seule la première instance
   *  d'un type la porte — évite les ids dupliqués avec les multi-instances. */
  anchored?: boolean;
}

/** Mappe un bloc + ses réglages vers son composant, avec narrowing par type. */
export function renderBlock(instance: BlockInstance, ctx: BlockRenderContext): React.ReactNode {
  const { products, whatsappPhone } = ctx;
  const anchored = ctx.anchored ?? true;
  switch (instance.type) {
    case "hero":
      return <HeroBlock settings={instance.settings as HeroSettings} />;
    case "cats":
      return <CategoryTilesBlock settings={instance.settings as CatsSettings} products={products} />;
    case "grid":
      return <ProductGridBlock settings={instance.settings as GridSettings} products={products} />;
    case "boutique":
      return <BoutiqueBlock settings={instance.settings as BoutiqueSettings} />;
    case "loyalty":
      return <LoyaltyBannerBlock settings={instance.settings as LoyaltySettings} />;
    case "featured":
      return <FeaturedProductBlock settings={instance.settings as FeaturedSettings} products={products} />;
    case "story":
      return <StoryBlock settings={instance.settings as StorySettings} anchored={anchored} />;
    case "look":
      return <LookbookBlock settings={instance.settings as LookSettings} />;
    case "news":
      return <NewsletterBlock settings={instance.settings as NewsSettings} />;
    case "contact":
      return <ContactBlock settings={instance.settings as ContactSettings} whatsappPhone={whatsappPhone} anchored={anchored} />;
    default:
      return null;
  }
}
