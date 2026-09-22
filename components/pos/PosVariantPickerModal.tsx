"use client";

import { useEffect } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import type { Product, ProductVariantData } from "@/lib/data/types";

interface PosVariantPickerModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectVariant: (product: Product, variant: ProductVariantData) => void;
}

export function PosVariantPickerModal({
  product,
  isOpen,
  onClose,
  onSelectVariant,
}: PosVariantPickerModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !product) return null;

  const activeVariants = (product.variants ?? []).filter((v) => v.active);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-variant-picker-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 65,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(30, 27, 24, 0.52)",
        backdropFilter: "blur(2px)",
        animation: "ft-fade 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 20px 48px -6px rgba(30,27,24,0.24)",
          border: adminBorder,
          overflow: "hidden",
          animation: "ft-fade 0.18s ease-out",
        }}
      >
        {/* En-tête produit */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${colors.borderSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: colors.ivory,
          }}
        >
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt=""
              style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flex: "none" }}
            />
          ) : (
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: product.swatch,
                border: "1px solid rgba(0,0,0,0.1)",
                flex: "none",
              }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="pos-variant-picker-title"
              style={{
                margin: 0,
                fontFamily: fonts.display,
                fontWeight: 600,
                fontSize: 16,
                color: colors.ink,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {product.name}
            </h3>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {product.variant} ·{" "}
              <span style={{ fontWeight: 600, color: colors.ink }}>{money(product.price)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: "none",
              background: "#EBE5D8",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.muted,
              flex: "none",
            }}
          >
            <Icon path={ICONS.close} size={15} />
          </button>
        </div>

        {/* Corps : Liste des teintes disponibles */}
        <div style={{ padding: "16px 20px", maxHeight: "60vh", overflowY: "auto" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: ".04em",
              marginBottom: 10,
            }}
          >
            Choisir la couleur à ajouter au ticket ({activeVariants.length})
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {activeVariants.map((v) => {
              const outOfStock = v.stock === 0;
              const lowStock = v.stock > 0 && v.stock <= 4;

              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onSelectVariant(product, v);
                    onClose();
                  }}
                  className="ft-hover-surface"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: `1.5px solid ${colors.borderField}`,
                    background: outOfStock ? colors.rowAlt : "#fff",
                    cursor: outOfStock ? "not-allowed" : "pointer",
                    textAlign: "left",
                    opacity: outOfStock ? 0.45 : 1,
                    transition: "border-color .15s, background .15s",
                  }}
                >
                  {/* Pastille ou photo de la variante */}
                  {v.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.image}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        objectFit: "cover",
                        border: "1px solid rgba(0,0,0,0.1)",
                        flex: "none",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: v.colorHex,
                        border: "1px solid rgba(0,0,0,0.15)",
                        flex: "none",
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
                      }}
                    />
                  )}

                  {/* Nom commercial de la couleur */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: colors.ink }}>
                      {v.colorName}
                    </div>
                    <div style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>
                      {v.colorHex}
                    </div>
                  </div>

                  {/* Badge de disponibilité stock */}
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: outOfStock
                        ? colors.bgDanger
                        : lowStock
                          ? colors.bgWarning
                          : colors.bgSuccess,
                      color: outOfStock
                        ? colors.fgDanger
                        : lowStock
                          ? colors.fgWarning
                          : colors.fgSuccess,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {outOfStock
                      ? "Épuisé"
                      : lowStock
                        ? `${v.stock} restant${v.stock > 1 ? "s" : ""}`
                        : `${v.stock} en stock`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pied */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${colors.borderSoft}`,
            background: "#FAF7F2",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 38,
              padding: "0 16px",
              borderRadius: 8,
              border: `1.5px solid ${colors.borderField}`,
              background: "#fff",
              color: colors.ink,
              font: `600 13px ${fonts.ui}`,
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
