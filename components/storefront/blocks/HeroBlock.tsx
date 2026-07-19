import Image from "next/image";
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import type { HeroSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function HeroBlock({ settings }: { settings: HeroSettings }) {
  return (
    <BlockFrame id="hero">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ft-store-hero"
            style={{
              position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end",
              background: settings.backgroundImage
                ? undefined
                : "repeating-linear-gradient(45deg,#d8ccb8,#d8ccb8 12px,#e2d7c4 12px,#e2d7c4 24px)",
            }}
          >
            {settings.backgroundImage ? (
              <Image src={settings.backgroundImage} alt="" fill sizes="100vw" style={{ objectFit: "cover" }} priority />
            ) : (
              <span style={{ position: "absolute", top: 14, left: 16, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>
                visuel hero · 16:9
              </span>
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(30,27,24,.6), rgba(30,27,24,.05) 60%)" }} />
            <div className="ft-store-hero-text" style={{ position: "relative", color: "#fff", maxWidth: 560 }}>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,.5)", borderRadius: 999,
                  font: `600 12px ${fonts.ui}`, letterSpacing: ".06em", marginBottom: 16,
                }}
              >
                {settings.eyebrow}
              </div>
              <h1 className="ft-store-hero-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.04, margin: "0 0 12px" }}>
                {settings.title.split("\n").map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </h1>
              <p className="ft-store-hero-sub" style={{ opacity: 0.92, lineHeight: 1.5, margin: "0 0 22px", maxWidth: 420 }}>
                {settings.subtitle}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={settings.ctaLink} style={{ height: 48, padding: "0 26px", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}>
                  {settings.ctaLabel}
                </Link>
                <Link href={settings.secondaryCtaLink} style={{ height: 48, padding: "0 22px", border: "1.5px solid rgba(255,255,255,.7)", borderRadius: 10, background: "rgba(255,255,255,.08)", color: "#fff", font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center" }}>
                  {settings.secondaryCtaLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
