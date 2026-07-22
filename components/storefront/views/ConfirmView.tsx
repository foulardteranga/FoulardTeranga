"use client";

import Link from "next/link";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { whatsappLink } from "@/lib/format";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import type { Order } from "@/lib/data/types";
import type { OrderStatusEventView } from "@/lib/data/orders.server";

export function ConfirmView({
  order,
  events,
  whatsappPhone,
}: {
  order: Order | null;
  events: OrderStatusEventView[];
  whatsappPhone?: string | null;
}) {
  if (!order) {
    return (
      <div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: colors.muted, marginBottom: 12 }}>Commande introuvable.</p>
        <Link href="/catalogue" style={{ color: colors.primary, fontWeight: 600 }}>Découvrir la boutique →</Link>
      </div>
    );
  }

  return (
    <div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="ft-store-conf-pad" style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: "#E6F4EE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon path={ICONS.check} size={32} stroke={colors.success} strokeWidth={2} />
        </div>
        <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 8px", letterSpacing: "-.01em" }}>
          Demande envoyée !
        </h1>
        <p style={{ fontSize: 15, color: colors.muted, margin: "0 auto 6px", maxWidth: 420, lineHeight: 1.55 }}>
          Merci {order.client}. La gérante vous contactera très vite pour confirmer votre commande.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, font: `600 13px ${fonts.ui}`, color: colors.primary, background: colors.bgInfo, padding: "6px 14px", borderRadius: 999, marginTop: 8 }}>
          Commande {order.id}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px", marginTop: 16 }}>
        <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 22 }}>Suivi de la demande</div>
        <OrderStatusTimeline status={order.status} events={events} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        {whatsappPhone && (
          <a
            href={whatsappLink(whatsappPhone, `Bonjour, je suis ${order.client} — je souhaite suivre ma commande ${order.id}.`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, minWidth: 180, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 50, borderRadius: 10, background: colors.success, color: "#fff", font: `700 15px ${fonts.ui}` }}
          >
            <Icon path={ICONS.whatsapp} size={20} stroke="#fff" strokeWidth={1.75} />
            Suivre sur WhatsApp
          </a>
        )}
        <Link href="/compte" style={{ flex: 1, minWidth: 180, height: 50, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 15px ${fonts.ui}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Voir mes commandes
        </Link>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/catalogue" style={{ font: `600 14px ${fonts.ui}`, color: colors.primary }}>
          Continuer mes achats →
        </Link>
      </div>
    </div>
  );
}
