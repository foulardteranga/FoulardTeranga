import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { statusMeta } from "@/lib/data/orderStatus";
import type { OrderStatus } from "@/lib/data/types";
import type { OrderStatusEventView } from "@/lib/data/orders.server";

const STEPS: Array<{ status: OrderStatus; title: string; desc: string }> = [
  { status: "nouvelle", title: "En attente de confirmation", desc: "Nous avons bien reçu votre demande." },
  { status: "confirmee", title: "Confirmée", desc: "La gérante valide la disponibilité et le prix." },
  { status: "preparation", title: "En préparation", desc: "Vos articles sont emballés avec soin." },
  { status: "livree", title: "Livrée", desc: "Remise en main propre ou par livreur." },
];

/** Étapes de vie d'une commande, avec horodatage réel quand l'événement existe
 *  (sinon repli sur la description générique — ex. commande antérieure à ce journal). */
export function OrderStatusTimeline({
  status,
  events,
  showAuthor = false,
}: {
  status: OrderStatus;
  events: OrderStatusEventView[];
  showAuthor?: boolean;
}) {
  if (status === "refusee") {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: statusMeta.refusee.bg, borderRadius: 12, padding: "14px 16px" }}>
        <Icon path={ICONS.infoAlt} size={18} stroke={statusMeta.refusee.color} strokeWidth={2} style={{ flex: "none", marginTop: 1 }} />
        <div>
          <div style={{ font: `600 14.5px ${fonts.ui}`, color: statusMeta.refusee.color }}>Commande refusée</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            La gérante n&apos;a pas pu donner suite à cette demande. Contactez-la pour plus de détails.
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = STEPS.findIndex((s) => s.status === status);
  const eventByStatus = new Map(events.map((e) => [e.status, e]));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {STEPS.map((step, i) => {
        const reached = i <= activeIndex;
        const current = i === activeIndex;
        const last = i === STEPS.length - 1;
        const event = eventByStatus.get(step.status);
        return (
          <div key={step.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
              <span
                style={{
                  width: 30, height: 30, borderRadius: 999, background: reached ? colors.success : "#F1ECE2",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: reached ? "#fff" : "#9a8f7d", font: `700 13px ${fonts.ui}`,
                }}
              >
                {current ? "●" : reached ? "✓" : i + 1}
              </span>
              {!last && <span style={{ width: 2, height: 26, background: reached && !current ? colors.success : "#EAE4D9" }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 18 }}>
              <div style={{ font: `600 14.5px ${fonts.ui}`, color: reached ? colors.ink : "#9a8f7d" }}>{step.title}</div>
              <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {event ? `${event.date}${showAuthor && event.authorName ? ` · ${event.authorName}` : ""}` : step.desc}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
