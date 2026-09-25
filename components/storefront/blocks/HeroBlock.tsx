import Image from "next/image";
import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { stripe } from "@/lib/theme/storefront";
import type { HeroSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

const DEFAULT_HERO_CARDS = [
  { title: "Foulard Wax", subtitle: "Wax Abidjan", hex: "#26326B" },
  { title: "Turban Soie", subtitle: "Kente royal", hex: "#D07A34" },
  { title: "Bazin Brodé", subtitle: "Damassé or", hex: "#C9A227" },
  { title: "Mousseline", subtitle: "Uni émeraude", hex: "#1E5F4E" },
  { title: "Kente Tissé", subtitle: "Artisanal", hex: "#7A2E5D" },
  { title: "Pagne Woodin", subtitle: "Coton prestige", hex: "#8A3A1C" },
];

export function HeroBlock({ settings }: { settings: HeroSettings }) {
  const images = Array.isArray(settings.images) ? settings.images : [];
  const hasImages = images.length > 0;
  const legacyBackground = settings.backgroundImage;

  // Si des images sont uploadées, on les fait défiler. Sinon, cartes de motifs Teranga.
  const displayItems = hasImages
    ? images
    : legacyBackground
    ? [legacyBackground]
    : DEFAULT_HERO_CARDS;

  // Duplication de la liste pour assurer un défilement infini sans coupure (seamless loop)
  const marqueeItems = displayItems.length > 0 ? [...displayItems, ...displayItems] : [];

  return (
    <BlockFrame id="hero">
      <section className="ft-store-section">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div
            className="ft-store-hero"
            style={{
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "flex-end",
              background: "#1E1B18",
            }}
          >
            {/* Bande déroulante continue d'images (Marquee horizontal infini) */}
            <style>{`
              @keyframes ft-hero-marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .ft-hero-marquee-viewport {
                position: absolute !important;
                inset: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                z-index: 0 !important;
              }
              .ft-hero-marquee-track {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                width: max-content !important;
                flex-shrink: 0 !important;
                animation: ft-hero-marquee 32s linear infinite !important;
                will-change: transform !important;
              }
              .ft-store-hero:hover .ft-hero-marquee-track {
                animation-play-state: paused !important;
              }
              .ft-hero-marquee-card {
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                width: 320px !important;
                height: 430px !important;
                border-radius: 18px !important;
                overflow: hidden !important;
                position: relative !important;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35) !important;
                border: 1px solid rgba(255, 255, 255, 0.16) !important;
                background: #2a2521 !important;
              }
              @media (max-width: 1024px) {
                .ft-hero-marquee-card {
                  width: 260px !important;
                  height: 360px !important;
                }
              }
              @media (max-width: 640px) {
                .ft-hero-marquee-track {
                  gap: 14px !important;
                  animation-duration: 28s !important;
                }
                .ft-hero-marquee-card {
                  width: 235px !important;
                  height: 325px !important;
                  border-radius: 14px !important;
                }
              }
              .ft-hero-overlay {
                position: absolute !important;
                inset: 0 !important;
                background: linear-gradient(90deg, rgba(16, 14, 12, 0.95) 0%, rgba(16, 14, 12, 0.85) 28%, rgba(16, 14, 12, 0.42) 44%, rgba(16, 14, 12, 0.05) 56%, transparent 66%) !important;
                z-index: 1 !important;
                pointer-events: none !important;
              }
              @media (max-width: 640px) {
                .ft-hero-overlay {
                  background: linear-gradient(to top, rgba(16, 14, 12, 0.94) 0%, rgba(16, 14, 12, 0.70) 48%, rgba(16, 14, 12, 0.12) 75%, transparent 100%) !important;
                }
              }
            `}</style>

            <div
              className="ft-hero-marquee-viewport"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                zIndex: 0,
              }}
            >
              <div
                className="ft-hero-marquee-track"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "nowrap",
                  alignItems: "center",
                  width: "max-content",
                  flexShrink: 0,
                  gap: 20,
                  animation: "ft-hero-marquee 35s linear infinite",
                  willChange: "transform",
                }}
              >
                {marqueeItems.map((item, idx) => {
                  const key = typeof item === "string" ? `${item}-${idx}` : `${item.title}-${idx}`;
                  if (typeof item === "string") {
                    return (
                      <div key={key} className="ft-hero-marquee-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item}
                          alt=""
                          loading="eager"
                          decoding="async"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                            filter: "brightness(1.08) contrast(1.03) saturate(1.04)",
                          }}
                        />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={key}
                      className="ft-hero-marquee-card"
                      style={{
                        background: stripe(item.hex),
                        display: "flex",
                        alignItems: "flex-end",
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(255,255,255,0.92)",
                          borderRadius: 8,
                          padding: "6px 8px",
                          width: "100%",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 12, color: "#1E1B18" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 10, color: "#786E64" }}>{item.subtitle}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voile dégradé : sombre uniquement sous le texte à gauche, 100% transparent et lumineux sur les images au centre et à droite */}
            <div className="ft-hero-overlay" />

            {/* Contenu textuel et boutons CTA */}
            <div className="ft-store-hero-text" style={{ position: "relative", zIndex: 2, color: "#fff", maxWidth: 560 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  border: "1px solid rgba(255,255,255,.5)",
                  borderRadius: 999,
                  font: `600 12px ${fonts.ui}`,
                  letterSpacing: ".06em",
                  marginBottom: 16,
                }}
              >
                {settings.eyebrow}
              </div>
              <h1 className="ft-store-hero-title" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.04, margin: "0 0 12px", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
                {settings.title.split("\n").map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </h1>
              <p className="ft-store-hero-sub" style={{ opacity: 0.95, lineHeight: 1.5, margin: "0 0 22px", maxWidth: 420, textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
                {settings.subtitle}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  href={settings.ctaLink}
                  style={{
                    height: 48,
                    padding: "0 26px",
                    borderRadius: 10,
                    background: "#D07A34",
                    color: "#fff",
                    font: `700 15px ${fonts.ui}`,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {settings.ctaLabel}
                </Link>
                <Link
                  href={settings.secondaryCtaLink}
                  style={{
                    height: 48,
                    padding: "0 22px",
                    border: "1.5px solid rgba(255,255,255,.7)",
                    borderRadius: 10,
                    background: "rgba(255,255,255,.08)",
                    color: "#fff",
                    font: `600 15px ${fonts.ui}`,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
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
