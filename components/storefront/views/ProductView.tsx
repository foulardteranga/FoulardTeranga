"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { money, fmt } from "@/lib/format";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { AvailabilityChip } from "@/components/storefront/AvailabilityChip";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/lib/data/types";

const COLOR_NAMES: Record<string, string> = {
  "#26326B": "Indigo",
  "#D07A34": "Terracotta",
  "#C9A227": "Or",
  "#0E9F6E": "Vert",
  "#1E1B18": "Noir",
};

export function ProductView({ product, related }: { product: Product; related: Product[] }) {
  const router = useRouter();
  const [colorIdx, setColorIdx] = useState(0);
  const [lenIdx, setLenIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);

  const photos = [product.image, ...product.gallery].filter((u): u is string => Boolean(u));
  const [photoIdx, setPhotoIdx] = useState(0);

  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const stock = product.stock;
  const soldOut = stock <= 0;
  const variant = product.lengths[lenIdx];

  const doAdd = () => {
    if (soldOut) { showToast("Article épuisé", "error"); return; }
    addToCart({ productId: product.id, name: product.name, variant, colorHex: product.colors[colorIdx], price: product.price, qty, image: product.image });
    showToast("Ajouté au panier", "success");
  };

  const buyNow = () => {
    if (soldOut) { showToast("Article épuisé", "error"); return; }
    addToCart({ productId: product.id, name: product.name, variant, colorHex: product.colors[colorIdx], price: product.price, qty, image: product.image });
    router.push("/commander");
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: product.cat, href: `/catalogue?cat=${encodeURIComponent(product.cat)}` },
          { label: product.name },
        ]}
      />

      <div className="ft-store-detail" style={{ display: "grid", alignItems: "start" }}>
        <div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", aspectRatio: "4 / 5", background: stripe(product.colors[colorIdx]), display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            {photos.length > 0 ? (
              <Image
                src={photos[Math.min(photoIdx, photos.length - 1)]}
                alt={product.name}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
                priority
              />
            ) : (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#9a8f7d" }}>photo produit 4:5</span>
            )}
            <button
              onClick={() => setFav((v) => !v)}
              aria-label="Ajouter aux favoris"
              style={{ position: "absolute", top: 14, right: 14, width: 42, height: 42, border: "none", borderRadius: 999, background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <Icon path={ICONS.heart} size={20} fill={fav ? colors.accent : "none"} stroke={colors.ink} strokeWidth={1.75} />
            </button>
          </div>
          {photos.length > 1 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {photos.slice(0, 4).map((src, i) => (
                <button
                  key={src}
                  onClick={() => setPhotoIdx(i)}
                  aria-label={`Photo ${i + 1}`}
                  style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", padding: 0, cursor: "pointer", border: i === photoIdx ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)", background: "none" }}
                >
                  <Image src={src} alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                </button>
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {product.colors.slice(0, 4).map((hex, i) => (
                <div key={hex} style={{ aspectRatio: "1", borderRadius: 10, background: stripe(hex), border: i === colorIdx ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)" }} />
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {product.badge && (
            <span style={{ display: "inline-block", font: `700 11px ${fonts.ui}`, padding: "4px 9px", borderRadius: 6, background: product.badge.includes("★") ? "#1E1B18" : colors.accent, color: "#fff", marginBottom: 12 }}>
              {product.badge}
            </span>
          )}
          <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.08, margin: "0 0 8px", letterSpacing: "-.01em" }}>
            {product.name}
          </h1>
          <div style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>{product.variant}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
            {product.oldPrice && <span style={{ fontSize: 15, color: "#9a8f7d", textDecoration: "line-through" }}>{fmt(product.oldPrice)}</span>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <AvailabilityChip stock={stock} />
          </div>
          <p style={{ fontSize: 15, color: colors.muted, lineHeight: 1.6, margin: "0 0 24px" }}>{product.description}</p>

          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 10 }}>
            Couleur — <span style={{ color: colors.muted, fontWeight: 500 }}>{COLOR_NAMES[product.colors[colorIdx]] ?? product.colors[colorIdx]}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
            {product.colors.map((hex, i) => (
              <span
                key={hex}
                onClick={() => setColorIdx(i)}
                title={COLOR_NAMES[hex] ?? hex}
                style={{ width: 34, height: 34, borderRadius: 999, background: hex, cursor: "pointer", outline: i === colorIdx ? `2px solid ${colors.ink}` : "2px solid transparent", outlineOffset: 2 }}
              />
            ))}
          </div>

          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 10 }}>Longueur</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
            {product.lengths.map((len, i) => {
              const active = i === lenIdx;
              return (
                <span
                  key={len}
                  onClick={() => setLenIdx(i)}
                  style={{ height: 40, padding: "0 18px", display: "inline-flex", alignItems: "center", borderRadius: 8, font: `600 13.5px ${fonts.ui}`, cursor: "pointer", border: `1.5px solid ${active ? colors.primary : colors.borderField}`, background: active ? colors.primary : "#fff", color: active ? "#fff" : colors.ink }}
                >
                  {len}
                </span>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", height: 50, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 46, height: "100%", border: "none", background: colors.ivory, fontSize: 20, color: colors.primary, cursor: "pointer" }}>−</button>
              <span style={{ width: 48, textAlign: "center", font: `600 16px ${fonts.ui}` }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 46, height: "100%", border: "none", background: colors.ivory, fontSize: 20, color: colors.primary, cursor: "pointer" }}>+</button>
            </div>
            <button
              onClick={doAdd}
              disabled={soldOut}
              style={{ flex: 1, minWidth: 180, height: 50, padding: "0 24px", border: "none", borderRadius: 10, background: soldOut ? "#C7C1B6" : colors.primary, color: "#fff", font: `700 15px ${fonts.ui}`, cursor: soldOut ? "not-allowed" : "pointer" }}
            >
              {soldOut ? "Indisponible" : "Ajouter au panier"}
            </button>
          </div>
          <button
            onClick={buyNow}
            style={{ width: "100%", height: 50, marginTop: 12, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
          >
            Commander maintenant — en 3 clics
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: colors.muted }}>
            <Icon path={ICONS.check} size={16} stroke={colors.success} strokeWidth={1.9} />
            Commande = demande à confirmer, sans paiement en ligne. La gérante vous recontacte.
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 18px", letterSpacing: "-.01em" }}>
            Vous aimerez aussi
          </h2>
          <div className="ft-store-home-grid" style={{ display: "grid" }}>
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                stock={p.stock}
                onAdd={() => {
                  addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price, image: p.image });
                  showToast("Ajouté au panier", "success");
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
