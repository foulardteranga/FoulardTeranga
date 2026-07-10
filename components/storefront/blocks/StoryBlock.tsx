import { fonts, colors } from "@/lib/theme/tokens";
import { BlockFrame } from "./BlockFrame";

export function StoryBlock() {
  return (
    <BlockFrame id="story">
      <section id="ft-story" style={{ background: "#F4EFE7", borderTop: "1px solid rgba(30,27,24,.06)", borderBottom: "1px solid rgba(30,27,24,.06)" }}>
        <div className="ft-store-section ft-store-story" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", alignItems: "center" }}>
          <div>
            <div style={{ font: `600 12px ${fonts.ui}`, letterSpacing: ".1em", color: colors.gold, textTransform: "uppercase", marginBottom: 12 }}>
              Notre histoire
            </div>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, lineHeight: 1.12, margin: "0 0 16px", letterSpacing: "-.01em" }}>
              L&apos;esprit Teranga, tissé dans chaque pièce
            </h2>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 14px" }}>
              « Teranga », c&apos;est l&apos;hospitalité sénégalaise. Depuis Abidjan, chaque foulard est choisi
              auprès d&apos;artisanes partenaires, teint à la main selon des savoir-faire transmis de mère en fille.
            </p>
            <p style={{ fontSize: 16, color: colors.muted, lineHeight: 1.65, margin: "0 0 20px" }}>
              Des matières nobles, des motifs qui racontent, une élégance qui vous ressemble.
            </p>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <StatItem value="100%" label="tissé main" />
              <StatItem value="24" label="artisanes partenaires" />
              <StatItem value="3" label="pays livrés" />
            </div>
          </div>
          <div
            className="ft-store-story-img"
            style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "repeating-linear-gradient(45deg,#e0d4c0,#e0d4c0 11px,#ebe1d1 11px,#ebe1d1 22px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#9a8f7d" }}>atelier · artisanat</span>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 30, color: colors.primary }}>{value}</div>
      <div style={{ fontSize: 13, color: colors.muted }}>{label}</div>
    </div>
  );
}
