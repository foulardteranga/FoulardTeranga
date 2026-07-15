"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { newestProducts } from "@/lib/data/catalog";
import { useStorefront } from "@/lib/store/useStorefront";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";
import type { GridSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function ProductGridBlock({ settings, products = [] }: { settings: GridSettings; products?: Product[] }) {
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);
  const featured = newestProducts(products, 4);

  return (
    <BlockFrame id="grid">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
            <div>
              <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 6 }}>
                À la une
              </div>
              <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
                {settings.title}
              </h2>
            </div>
            <Link href="/catalogue" style={{ font: `600 14px ${fonts.ui}`, color: colors.primary, whiteSpace: "nowrap" }}>
              Tout voir →
            </Link>
          </div>
          <div className="ft-store-home-grid" style={{ display: "grid" }}>
            {featured.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                stock={p.stock}
                onAdd={() => {
                  addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                  showToast("Ajouté au panier", "success");
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
