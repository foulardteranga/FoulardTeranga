"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import { featuredProduct } from "@/lib/data/catalog";
import { useStorefront } from "@/lib/store/useStorefront";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";
import type { FeaturedSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function FeaturedProductBlock({ settings, products = [] }: { settings: FeaturedSettings; products?: Product[] }) {
  void settings;
  const product = featuredProduct(products);
  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  if (!product) return null;

  const stock = product.stock;

  return (
    <BlockFrame id="featured">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-feat" style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, overflow: "hidden", display: "grid" }}>
            <div className="ft-store-feat-img" style={{ position: "relative", background: stripe(product.colors[0]), display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", top: 14, left: 14, font: `700 11px ${fonts.ui}`, padding: "5px 10px", borderRadius: 999, background: "#1E1B18", color: colors.gold, border: `1px solid ${colors.gold}` }}>
                ★ Coup de cœur
              </span>
            </div>
            <div className="ft-store-feat-pad" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 10 }}>
                Édition limitée
              </div>
              <h3 className="ft-store-feat-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.1, margin: "0 0 10px" }}>
                {product.name}
              </h3>
              <p style={{ fontSize: 15, color: colors.muted, lineHeight: 1.55, margin: "0 0 18px" }}>{product.description}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
                <span style={{ fontSize: 14, color: colors.muted }}>· {product.lengths[0]}</span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href={`/produit/${product.id}`}
                  style={{ height: 48, padding: "0 26px", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}
                >
                  Voir le produit
                </Link>
                <button
                  onClick={() => {
                    if (stock <= 0) { showToast("Article épuisé", "error"); return; }
                    addToCart({ productId: product.id, name: product.name, variant: product.lengths[0], colorHex: product.colors[0], price: product.price });
                    showToast("Ajouté au panier", "success");
                  }}
                  style={{ height: 48, padding: "0 22px", border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
                >
                  Ajouter au panier
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
