import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import type { BoutiqueSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function BoutiqueBlock({ settings }: { settings: BoutiqueSettings }) {
  return (
    <BlockFrame id="boutique">
      <section className="ft-store-section-tight">
        <div
          style={{
            maxWidth: 1200, margin: "0 auto", background: colors.ivory, borderRadius: 16,
            padding: "36px 28px", textAlign: "center",
          }}
        >
          <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-.01em" }}>
            {settings.title}
          </h2>
          {settings.subtitle.trim() !== "" && (
            <p style={{ fontSize: 15, color: colors.muted, maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.55 }}>
              {settings.subtitle}
            </p>
          )}
          <Link
            href={settings.ctaLink}
            style={{ display: "inline-flex", height: 48, padding: "0 26px", borderRadius: 10, background: colors.primary, color: "#fff", font: `700 15px ${fonts.ui}`, alignItems: "center" }}
          >
            {settings.ctaLabel}
          </Link>
        </div>
      </section>
    </BlockFrame>
  );
}
