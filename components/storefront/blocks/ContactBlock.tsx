import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { whatsappLink } from "@/lib/format";
import type { ContactSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function ContactBlock({ settings, whatsappPhone }: { settings: ContactSettings; whatsappPhone?: string | null }) {
  void settings;
  return (
    <BlockFrame id="contact">
      <section id="ft-contact" className="ft-store-section">
        <div className="ft-store-contact" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px" }}>
            <h3 style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 24, margin: "0 0 18px" }}>Nous trouver</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ContactRow icon={ICONS.mapPin} title="Boutique Plateau" body="Rue du Commerce, Plateau, Abidjan · Côte d'Ivoire" />
              <ContactRow icon={ICONS.clock} title="Horaires" body="Lun – Sam · 9h – 19h" />
              {whatsappPhone && (
                <a
                  href={whatsappLink(whatsappPhone, "Bonjour, je souhaite commander un article.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 48, borderRadius: 10, background: colors.success, color: "#fff", font: `700 15px ${fonts.ui}`, marginTop: 4 }}
                >
                  <Icon path={ICONS.whatsapp} size={20} stroke="#fff" strokeWidth={1.75} />
                  Commander sur WhatsApp
                </a>
              )}
            </div>
          </div>
          <div
            style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 220, background: "repeating-linear-gradient(45deg,#dfe1e8,#dfe1e8 11px,#e9eaef 11px,#e9eaef 22px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#8a8d99" }}>carte · localisation</span>
          </div>
        </div>
      </section>
    </BlockFrame>
  );
}

function ContactRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Icon path={icon} size={20} stroke={colors.primary} strokeWidth={1.75} style={{ flex: "none", marginTop: 2 }} />
      <div>
        <div style={{ font: `600 15px ${fonts.ui}` }}>{title}</div>
        <div style={{ fontSize: 14, color: colors.muted }}>{body}</div>
      </div>
    </div>
  );
}
