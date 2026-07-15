import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import type { LoyaltySettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function LoyaltyBannerBlock({ settings }: { settings: LoyaltySettings }) {
  void settings;
  return (
    <BlockFrame id="loyalty">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ft-store-promo"
            style={{ background: "#26326B", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap", color: "#fff" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 260 }}>
              <div style={{ width: 52, height: 52, flex: "none", borderRadius: 999, background: "#1E1B18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#C9A227" stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
              </div>
              <div>
                <div className="ft-store-promo-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.1 }}>
                  Programme fidélité Teranga
                </div>
                <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
                  Cumulez des points à chaque commande — 5% offerts dès 300 points.
                </div>
              </div>
            </div>
            <Link
              href="/compte"
              style={{ height: 46, padding: "0 24px", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}
            >
              Rejoindre le programme
            </Link>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
