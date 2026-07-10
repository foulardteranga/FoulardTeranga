"use client";

import Link from "next/link";
import { colors, fonts } from "@/lib/theme/tokens";
import { stripe, badgeBackground } from "@/lib/theme/storefront";
import { money, fmt } from "@/lib/format";
import type { Product } from "@/lib/data/types";

export function ProductCard({
  product,
  stock,
  onAdd,
}: {
  product: Product;
  /** Stock effectif (post-déduction) — calculé par l'appelant via useShop.effectiveStock. */
  stock: number;
  onAdd: () => void;
}) {
  const soldOut = stock <= 0;

  return (
    <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(60,40,20,.08)" }}>
      <Link href={`/produit/${product.id}`} style={{ display: "block", position: "relative", aspectRatio: "4 / 5", background: stripe(product.colors[0]) }}>
        {product.badge && (
          <span
            style={{
              position: "absolute", top: 10, left: 10,
              font: `700 11px ${fonts.ui}`, padding: "4px 8px", borderRadius: 6,
              background: badgeBackground(product.badge), color: "#fff",
            }}
          >
            {product.badge}
          </span>
        )}
        {soldOut && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(250,247,242,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ font: `600 12px ${fonts.ui}`, padding: "6px 12px", borderRadius: 999, background: colors.ink, color: "#fff" }}>
              Épuisé
            </span>
          </div>
        )}
      </Link>
      <div style={{ padding: "14px 16px 16px" }}>
        <Link href={`/produit/${product.id}`} style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, lineHeight: 1.2, marginBottom: 4, display: "block", color: colors.ink }}>
          {product.name}
        </Link>
        <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 12 }}>
          {product.motif !== "Uni" ? `${product.motif} · ${product.lengths[0]}` : product.lengths[0]}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.primary }}>{money(product.price)}</span>
            {product.oldPrice && <span style={{ fontSize: 12.5, color: "#9a8f7d", textDecoration: "line-through" }}>{fmt(product.oldPrice)}</span>}
          </div>
          <button
            onClick={onAdd}
            disabled={soldOut}
            title="Ajouter"
            style={{
              width: 38, height: 38, flex: "none", borderRadius: 10,
              border: `1.5px solid ${soldOut ? "#EAE4D9" : colors.primary}`,
              background: soldOut ? "#F4F0E9" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: soldOut ? "not-allowed" : "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={soldOut ? "#C7BFB2" : colors.primary} strokeWidth={1.9} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
