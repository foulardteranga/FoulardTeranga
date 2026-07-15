import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { storefrontCategories } from "@/lib/data/catalog";
import type { Product } from "@/lib/data/types";
import type { CatsSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

const TILE_COLOR: Record<string, string> = {
  Foulards: "#26326B",
  Turbans: "#D07A34",
  Accessoires: "#C9A227",
};

export function CategoryTilesBlock({ settings, products = [] }: { settings: CatsSettings; products?: Product[] }) {
  void settings;
  return (
    <BlockFrame id="cats">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-cats" style={{ display: "grid", gap: 14 }}>
            {storefrontCategories.map((cat) => {
              const count = products.filter((p) => p.cat === cat).length;
              return (
                <Link
                  key={cat}
                  href={`/catalogue?cat=${encodeURIComponent(cat)}`}
                  style={{
                    position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "4 / 3",
                    background: stripe(TILE_COLOR[cat]), display: "block",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,27,24,.5), transparent 65%)" }} />
                  <div style={{ position: "absolute", left: 16, bottom: 14, color: "#fff" }}>
                    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22 }}>{cat}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.9 }}>{count} modèles →</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
