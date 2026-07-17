import Image from "next/image";
import { fonts, colors } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import type { LookSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

const LOOKS = [
  { label: "look 01 · 3:4", hex: "#26326B" },
  { label: "look 02 · 3:4", hex: "#D07A34" },
  { label: "look 03 · 3:4", hex: "#C9A227" },
  { label: "look 04 · 3:4", hex: "#0E9F6E" },
];

export function LookbookBlock({ settings }: { settings: LookSettings }) {
  return (
    <BlockFrame id="look">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 6 }}>
              {settings.eyebrow}
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: 0, letterSpacing: "-.01em" }}>
              {settings.title}
            </h2>
          </div>
          <div className="ft-store-look-grid" style={{ display: "grid", gap: 12 }}>
            {settings.images.length > 0
              ? settings.images.map((src, i) => (
                  <div key={src + i} style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "3 / 4" }}>
                    <Image src={src} alt="" fill sizes="(max-width: 900px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                  </div>
                ))
              : LOOKS.map((look) => (
                  <div
                    key={look.label}
                    style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "3 / 4", background: stripe(look.hex), display: "flex", alignItems: "flex-end", padding: 12 }}
                  >
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, color: "#9a8f7d" }}>{look.label}</span>
                  </div>
                ))}
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
