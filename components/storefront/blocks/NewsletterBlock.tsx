"use client";

import { fonts } from "@/lib/theme/tokens";
import { useStorefront } from "@/lib/store/useStorefront";
import type { NewsSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function NewsletterBlock({ settings }: { settings: NewsSettings }) {
  const showToast = useStorefront((s) => s.showToast);

  return (
    <BlockFrame id="news">
      <section className="ft-store-section-tight">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ft-store-promo" style={{ background: "#1E1B18", borderRadius: 16, textAlign: "center", color: "#fff" }}>
            <h2 className="ft-store-h2" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 10px" }}>
              {settings.title}
            </h2>
            <p style={{ fontSize: 15, color: "#C9BEB0", margin: "0 auto 22px", maxWidth: 440, lineHeight: 1.55 }}>
              {settings.text}
            </p>
            <div style={{ display: "flex", gap: 10, maxWidth: 440, margin: "0 auto", flexWrap: "wrap" }}>
              <input
                placeholder={settings.placeholder}
                style={{ flex: 1, minWidth: 180, height: 48, padding: "0 16px", border: "none", borderRadius: 10, background: "#2c2822", color: "#fff", font: `400 15px ${fonts.ui}`, outline: "none" }}
              />
              <button
                onClick={() => showToast("Inscription enregistrée · +25 points", "success")}
                style={{ height: 48, padding: "0 24px", border: "none", borderRadius: 10, background: "#D07A34", color: "#fff", font: `700 15px ${fonts.ui}`, cursor: "pointer" }}
              >
                {settings.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}
