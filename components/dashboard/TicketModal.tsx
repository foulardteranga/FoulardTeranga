"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { money, whatsappLink, whatsappShareLink } from "@/lib/format";

export function TicketModal() {
  const ticket = useBackoffice((s) => s.ticket);
  const closeTicket = useBackoffice((s) => s.closeTicket);
  if (!ticket) return null;

  return (
    <div
      onClick={closeTicket}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,27,24,.5)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 18,
          overflow: "hidden",
          animation: "ft-fade .16s ease",
        }}
      >
        <div style={{ padding: "26px 24px 20px", textAlign: "center", background: colors.success }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <Icon path={ICONS.check} size={28} stroke={colors.success} strokeWidth={2} />
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22, color: "#fff" }}>
            Vente encaissée
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.88)", marginTop: 4 }}>
            Ticket généré avec succès
          </div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <Row label="Référence" value={ticket.ref} strong />
          <Row label="Articles" value={String(ticket.items)} />
          <Row label="Mode de paiement" value={ticket.pay} strong />
          <div style={{ borderTop: `1px solid ${colors.borderSoft}`, margin: "10px 0", paddingTop: 10 }}>
            {ticket.lines.map((l) => (
              <div key={l.name + l.qty} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: colors.ink }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name} × {l.qty}</span>
                <span style={{ fontWeight: 600 }}>{money(l.lineTotal)}</span>
              </div>
            ))}
          </div>
          {ticket.discount > 0 && <Row label="Sous-total" value={money(ticket.subtotal)} />}
          {ticket.discount > 0 && <Row label="Remise" value={`−${money(ticket.discount)}`} />}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderTop: `1px solid ${colors.borderSoft}`,
              paddingTop: 12,
              marginTop: 4,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15 }}>Total</span>
            <span
              style={{
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 24,
                color: colors.primary,
              }}
            >
              {ticket.total}
            </span>
          </div>
          {ticket.loyalty && (
            <Row
              label="Points gagnés"
              value={`+${ticket.loyalty.pointsEarned} · solde ${ticket.loyalty.newBalance}`}
            />
          )}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => {
                const url = ticket.customerPhone
                  ? whatsappLink(ticket.customerPhone, ticket.waMessage)
                  : whatsappShareLink(ticket.waMessage);
                window.open(url, "_blank", "noopener");
              }}
              style={{
                width: "100%",
                height: 46,
                border: "none",
                borderRadius: 10,
                background: "#25D366",
                color: "#fff",
                font: `600 14px ${fonts.ui}`,
                cursor: "pointer",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              {ICONS.whatsapp && <Icon path={ICONS.whatsapp} size={16} stroke="#fff" strokeWidth={1.9} />}
              Envoyer sur WhatsApp
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={closeTicket}
                style={{
                  flex: 1,
                  height: 46,
                  border: `1.5px solid ${colors.borderField}`,
                  borderRadius: 10,
                  background: "#fff",
                  color: colors.primary,
                  font: `600 14px ${fonts.ui}`,
                  cursor: "pointer",
                }}
              >
                Nouvelle vente
              </button>
              <button
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  height: 46,
                  border: "none",
                  borderRadius: 10,
                  background: colors.primary,
                  color: "#fff",
                  font: `600 14px ${fonts.ui}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <Icon path={ICONS.print} size={16} stroke="#fff" strokeWidth={1.9} />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        color: colors.muted,
        marginBottom: 8,
      }}
    >
      <span>{label}</span>
      <span style={strong ? { fontWeight: 600, color: colors.ink } : undefined}>{value}</span>
    </div>
  );
}
