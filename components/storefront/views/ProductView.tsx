"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { money, fmt } from "@/lib/format";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { AvailabilityChip } from "@/components/storefront/AvailabilityChip";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product, ProductVariantData } from "@/lib/data/types";

const COLOR_NAMES: Record<string, string> = {
  "#26326B": "Indigo",
  "#D07A34": "Terracotta",
  "#C9A227": "Or",
  "#0E9F6E": "Vert",
  "#1E1B18": "Noir",
};

export function ProductView({ product, related }: { product: Product; related: Product[] }) {
  const router = useRouter();
  const activeVariants = product.variants ? product.variants.filter((v) => v.active) : [];
  const hasVariants = activeVariants.length > 0;

  // Sélection de la variante initiale (priorité à une teinte ayant du stock)
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    if (hasVariants) {
      const inStock = activeVariants.find((v) => v.stock > 0);
      return inStock ? inStock.id : activeVariants[0].id;
    }
    return "";
  });

  // Fallback rétrocompatible si le produit n'a pas de variantes Prisma
  const [colorIdx, setColorIdx] = useState(0);
  const [lenIdx, setLenIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);
  const [showAllTeintes, setShowAllTeintes] = useState(false);

  // Variante actuellement sélectionnée
  const currentVariant: ProductVariantData | null = hasVariants
    ? (activeVariants.find((v) => v.id === selectedVariantId) ?? activeVariants[0])
    : null;

  // Stock et disponibilité de la couleur active
  const stock = currentVariant ? currentVariant.stock : product.stock;
  const soldOut = stock <= 0;

  // Nom et code HEX de la couleur active
  const currentColorName = currentVariant
    ? currentVariant.colorName
    : (COLOR_NAMES[product.colors[colorIdx]] ?? product.colors[colorIdx]);
  const currentColorHex = currentVariant
    ? currentVariant.colorHex
    : (product.colors[colorIdx] || product.swatch);

  // Gestion des photos (priorité à la photo de la variante si définie)
  const basePhotos = [product.image, ...product.gallery].filter((u): u is string => Boolean(u));
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null);

  const heroPhoto =
    selectedPhotoIdx !== null
      ? basePhotos[selectedPhotoIdx]
      : (currentVariant?.image || basePhotos[0]);

  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const lengthLabel = product.lengths[lenIdx] || product.variant;
  const variantLabel = currentVariant
    ? `${lengthLabel} · ${currentVariant.colorName}`
    : `${lengthLabel} · ${currentColorName}`;

  const doAdd = () => {
    if (soldOut) {
      showToast("Cette couleur est en rupture de stock", "error");
      return;
    }
    addToCart({
      productId: product.id,
      variantId: currentVariant?.id ?? null,
      variantName: currentVariant?.colorName ?? null,
      name: product.name,
      variant: variantLabel,
      colorHex: currentColorHex,
      price: product.price,
      qty,
      image: currentVariant?.image || product.image,
    });
    showToast("Ajouté au panier", "success");
  };

  const buyNow = () => {
    if (soldOut) {
      showToast("Cette couleur est en rupture de stock", "error");
      return;
    }
    addToCart({
      productId: product.id,
      variantId: currentVariant?.id ?? null,
      variantName: currentVariant?.colorName ?? null,
      name: product.name,
      variant: variantLabel,
      colorHex: currentColorHex,
      price: product.price,
      qty,
      image: currentVariant?.image || product.image,
    });
    router.push("/commander");
  };

  // Accordéon des pastilles de teintes (5 premières visibles par défaut si > 5)
  const initialLimit = 5;
  const hasMoreThan5 = activeVariants.length > initialLimit;
  const selectedIndex = activeVariants.findIndex((v) => v.id === selectedVariantId);
  const isSelectedBeyondLimit = selectedIndex >= initialLimit;
  const visibleVariants =
    hasMoreThan5 && !showAllTeintes && !isSelectedBeyondLimit
      ? activeVariants.slice(0, initialLimit)
      : activeVariants;

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
        {/* Galerie Photos */}
        <div>
          <div
            style={{
              position: "relative",
              borderRadius: 16,
              overflow: "hidden",
              aspectRatio: "4 / 5",
              background: stripe(currentColorHex),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            {heroPhoto ? (
              <Image
                src={heroPhoto}
                alt={`${product.name} — ${currentColorName}`}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
                priority
              />
            ) : (
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#9a8f7d" }}>
                photo produit 4:5
              </span>
            )}
            <button
              onClick={() => setFav((v) => !v)}
              aria-label="Ajouter aux favoris"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 42,
                height: 42,
                border: "none",
                borderRadius: 999,
                background: "rgba(255,255,255,.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              <Icon
                path={ICONS.heart}
                size={20}
                fill={fav ? colors.accent : "none"}
                stroke={colors.ink}
                strokeWidth={1.75}
              />
            </button>
          </div>

          {basePhotos.length > 1 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {basePhotos.slice(0, 4).map((src, i) => {
                const isActive = heroPhoto === src;
                return (
                  <button
                    key={src + i}
                    onClick={() => setSelectedPhotoIdx(i)}
                    aria-label={`Photo ${i + 1}`}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      borderRadius: 10,
                      overflow: "hidden",
                      padding: 0,
                      cursor: "pointer",
                      border: isActive ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)",
                      background: "none",
                    }}
                  >
                    <Image src={src} alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                  </button>
                );
              })}
            </div>
          ) : basePhotos.length === 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {(hasVariants ? activeVariants.map((v) => v.colorHex) : product.colors).slice(0, 4).map((hex, i) => (
                <div
                  key={hex + i}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 10,
                    background: stripe(hex),
                    border: hex === currentColorHex ? `2px solid ${colors.primary}` : "1px solid rgba(30,27,24,.1)",
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Détails Produit */}
        <div>
          {product.badge && (
            <span
              style={{
                display: "inline-block",
                font: `700 11px ${fonts.ui}`,
                padding: "4px 9px",
                borderRadius: 6,
                background: product.badge.includes("★") ? "#1E1B18" : colors.accent,
                color: "#fff",
                marginBottom: 12,
              }}
            >
              {product.badge}
            </span>
          )}
          <h1
            className="ft-store-h1"
            style={{
              fontFamily: fonts.display,
              fontWeight: 600,
              lineHeight: 1.08,
              margin: "0 0 8px",
              letterSpacing: "-.01em",
            }}
          >
            {product.name}
          </h1>
          <div style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>{product.variant}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
            {product.oldPrice && (
              <span style={{ fontSize: 15, color: "#9a8f7d", textDecoration: "line-through" }}>
                {fmt(product.oldPrice)}
              </span>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            <AvailabilityChip stock={stock} />
          </div>
          <p style={{ fontSize: 15, color: colors.muted, lineHeight: 1.6, margin: "0 0 24px" }}>
            {product.description}
          </p>

          {/* Sélecteur de Couleurs / Teintes */}
          <div
            style={{
              font: `600 13px ${fonts.ui}`,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>Couleur —</span>
            <span style={{ color: colors.ink, fontWeight: 700 }}>{currentColorName}</span>
            {soldOut && (
              <span
                style={{
                  font: `600 11.5px ${fonts.ui}`,
                  background: "#FDE8E8",
                  color: colors.danger,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(224,36,36,0.2)",
                }}
              >
                Épuisé pour cette teinte
              </span>
            )}
            {!soldOut && stock <= 3 && (
              <span
                style={{
                  font: `600 11.5px ${fonts.ui}`,
                  background: "#FEF3C7",
                  color: "#92400E",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Plus que {stock} dispo
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 22,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {hasVariants ? (
              <>
                {visibleVariants.map((v) => {
                  const isSelected = v.id === currentVariant?.id;
                  const isDepleted = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${v.colorName}${isDepleted ? " — épuisé" : ` — ${v.stock} disponible${v.stock > 1 ? "s" : ""}`}`}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setSelectedPhotoIdx(null); // Afficher automatiquement la photo de la variante si existante
                      }}
                      style={{
                        position: "relative",
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: v.colorHex,
                        cursor: "pointer",
                        border: "none",
                        padding: 0,
                        outline: "none",
                        boxShadow: isSelected
                          ? `0 0 0 2px #fff, 0 0 0 4.5px ${colors.ink}`
                          : "0 0 0 1px rgba(0,0,0,0.18)",
                        transform: isSelected ? "scale(1.1)" : "scale(1)",
                        transition: "transform .14s cubic-bezier(.2,.8,.2,1), box-shadow .14s cubic-bezier(.2,.8,.2,1)",
                        overflow: "hidden",
                        opacity: isDepleted ? 0.55 : 1,
                      }}
                    >
                      {isDepleted && (
                        <span
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "-25%",
                            right: "-25%",
                            height: 2,
                            background: "rgba(255,255,255,0.95)",
                            transform: "rotate(-45deg)",
                            boxShadow: "0 0 2px rgba(0,0,0,0.5)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
                {hasMoreThan5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTeintes((prev) => !prev)}
                    aria-expanded={showAllTeintes || isSelectedBeyondLimit}
                    style={{
                      border: `1px solid ${colors.borderSoft}`,
                      background: "#F8F5F0",
                      borderRadius: 999,
                      padding: "0 13px",
                      height: 36,
                      font: `600 12px ${fonts.ui}`,
                      color: colors.ink,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "background .15s ease",
                    }}
                  >
                    {showAllTeintes || isSelectedBeyondLimit
                      ? "− Moins de teintes"
                      : `+${activeVariants.length - initialLimit} autres teintes`}
                  </button>
                )}
              </>
            ) : (
              // Rétrocompatibilité produits sans table de variantes
              product.colors.map((hex, i) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColorIdx(i)}
                  title={COLOR_NAMES[hex] ?? hex}
                  aria-label={COLOR_NAMES[hex] ?? hex}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: hex,
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                    boxShadow: i === colorIdx ? `0 0 0 2px #fff, 0 0 0 4px ${colors.ink}` : "0 0 0 1px rgba(0,0,0,0.18)",
                    outline: "none",
                  }}
                />
              ))
            )}
          </div>

          {/* Longueur */}
          <div style={{ font: `600 13px ${fonts.ui}`, marginBottom: 10 }}>Longueur</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
            {product.lengths.map((len, i) => {
              const active = i === lenIdx;
              return (
                <span
                  key={len}
                  onClick={() => setLenIdx(i)}
                  style={{
                    height: 40,
                    padding: "0 18px",
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 8,
                    font: `600 13.5px ${fonts.ui}`,
                    cursor: "pointer",
                    border: `1.5px solid ${active ? colors.primary : colors.borderField}`,
                    background: active ? colors.primary : "#fff",
                    color: active ? "#fff" : colors.ink,
                  }}
                >
                  {len}
                </span>
              );
            })}
          </div>

          {/* Boutons d'action */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <QtyStepper qty={qty} onChange={setQty} max={stock} size="lg" />
            <button
              onClick={doAdd}
              disabled={soldOut}
              style={{
                flex: 1,
                minWidth: 180,
                height: 50,
                padding: "0 24px",
                border: "none",
                borderRadius: 10,
                background: soldOut ? "#C7C1B6" : colors.primary,
                color: "#fff",
                font: `700 15px ${fonts.ui}`,
                cursor: soldOut ? "not-allowed" : "pointer",
                boxShadow: soldOut ? "none" : "0 4px 14px rgba(0,0,0,0.08)",
                transition: "background .15s ease, transform .12s ease",
              }}
            >
              {soldOut ? "Teinte indisponible" : "Ajouter au panier"}
            </button>
          </div>
          <button
            onClick={buyNow}
            disabled={soldOut}
            style={{
              width: "100%",
              height: 50,
              marginTop: 12,
              border: `1.5px solid ${soldOut ? "#D6D0C5" : colors.primary}`,
              borderRadius: 10,
              background: soldOut ? "#F5F3EF" : "#fff",
              color: soldOut ? "#A39A8F" : colors.primary,
              font: `600 15px ${fonts.ui}`,
              cursor: soldOut ? "not-allowed" : "pointer",
              transition: "all .15s ease",
            }}
          >
            {soldOut ? "Rupture de stock pour cette couleur" : "Commander maintenant — en 3 clics"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: colors.muted }}>
            <Icon path={ICONS.check} size={16} stroke={colors.success} strokeWidth={1.9} />
            Commande = demande à confirmer, sans paiement en ligne. La gérante vous recontacte.
          </div>
        </div>
      </div>

      {/* Produits associés */}
      {related.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2
            className="ft-store-h2"
            style={{
              fontFamily: fonts.display,
              fontWeight: 600,
              margin: "0 0 18px",
              letterSpacing: "-.01em",
            }}
          >
            Vous aimerez aussi
          </h2>
          <div className="ft-store-home-grid" style={{ display: "grid" }}>
            {related.map((p) => {
              const activePVariants = p.variants ? p.variants.filter((v) => v.active) : [];
              const firstVariant = activePVariants.find((v) => v.stock > 0) ?? activePVariants[0];

              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  stock={p.stock}
                  onAdd={() => {
                    addToCart({
                      productId: p.id,
                      variantId: firstVariant?.id ?? null,
                      variantName: firstVariant?.colorName ?? null,
                      name: p.name,
                      variant: firstVariant
                        ? `${p.lengths[0] || p.variant} · ${firstVariant.colorName}`
                        : (p.lengths[0] || p.variant),
                      colorHex: firstVariant ? firstVariant.colorHex : p.colors[0],
                      price: p.price,
                      image: firstVariant?.image || p.image,
                    });
                    showToast("Ajouté au panier", "success");
                  }}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
