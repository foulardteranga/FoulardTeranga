import { fonts, colors } from "@/lib/theme/tokens";
import type { StorySettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function StoryBlock({ settings }: { settings: StorySettings }) {
  const stats = [
    { value: settings.stat1Value, label: settings.stat1Label },
    { value: settings.stat2Value, label: settings.stat2Label },
    { value: settings.stat3Value, label: settings.stat3Label },
  ];
  return (
    <BlockFrame id="story">
      <section id="ft-story" style={{ background: "#F4EFE7", borderTop: "1px solid rgba(30,27,24,.06)", borderBottom: "1px solid rgba(30,27,24,.06)" }}>
        <div className="ft-store-section ft-store-story" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", alignItems: "center" }}>
          <div>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 12 }}>
              {settings.eyebrow}
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.12, margin: "0 0 16px", letterSpacing: "-.01em" }}>
              {settings.title}
            </h2>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 14px" }}>{settings.body1}</p>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 20px" }}>{settings.body2}</p>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              {stats.map((s, i) => (
                <div key={i}>
                  <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 30, color: colors.primary }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: colors.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ft-store-story-img" style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "repeating-linear-gradient(45deg,#e0d4c0,#e0d4c0 11px,#ebe1d1 11px,#ebe1d1 22px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>atelier · artisanat</span>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
