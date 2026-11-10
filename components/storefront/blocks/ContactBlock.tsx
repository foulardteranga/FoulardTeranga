import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { whatsappLink } from "@/lib/format";
import { extractMapEmbedUrl, type ContactSettings } from "@/lib/storefront/blockSettings";
import { BlockFrame } from "./BlockFrame";

export function ContactBlock({ settings, whatsappPhone, anchored = true }: { settings: ContactSettings; whatsappPhone?: string | null; anchored?: boolean }) {
  const mapQuery = encodeURIComponent(settings.address);
  // Carte précise (position exacte) si la gérante a collé le code d'intégration Google Maps ;
  // sinon repli sur une recherche par adresse (moins précis, mais fonctionne sans configuration).
  const preciseEmbed = extractMapEmbedUrl(settings.mapEmbedUrl ?? "");
  const embedSrc = preciseEmbed || `https://www.google.com/maps?q=${mapQuery}&z=15&output=embed`;
  const mapLink = settings.mapUrl?.trim() || `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  return (
    <BlockFrame id="contact">
      <section id={anchored ? "ft-contact" : undefined} className="ft-store-section">
        <div className="ft-store-contact" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px" }}>
            <h3 style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 24, margin: "0 0 18px" }}>{settings.title}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ContactRow icon={ICONS.mapPin} title={settings.locationTitle} body={settings.address} />
              <ContactRow icon={ICONS.clock} title={settings.hoursTitle} body={settings.hours} />
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
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ouvrir « ${settings.locationTitle} » dans Maps`}
            style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 220, display: "block" }}
          >
            <iframe
              src={embedSrc}
              title={`Carte — ${settings.locationTitle}`}
              loading="lazy"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
            />
            <span
              style={{
                position: "absolute", bottom: 12, right: 12, display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(30,27,24,.18)",
                font: `600 13px ${fonts.ui}`, color: colors.primary,
              }}
            >
              <Icon path={ICONS.mapPin} size={16} stroke={colors.primary} strokeWidth={2} />
              Ouvrir dans Maps
            </span>
          </a>
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
