import { money } from "@/lib/format";

export interface TicketLine {
  name: string;
  qty: number;
  lineTotal: number;
}

export interface TicketMessageInput {
  shopName: string;
  ref: string;
  date: Date;
  lines: TicketLine[];
  /** Σ unitPrice × qty, avant remises. */
  subtotal: number;
  /** Remises par ligne agrégées en FCFA (0 = aucune). */
  discount: number;
  /** Montant réellement payé. */
  total: number;
  /** Libellé FR du mode de paiement (PAYMENT_LABELS). */
  payLabel: string;
  loyalty: { pointsEarned: number; newBalance: number } | null;
  promo: { code: string; discount: number } | null;
  pointsUsed: { points: number; discount: number } | null;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Reçu de caisse en texte WhatsApp (gras via *…*, listes via •). Pure et testée. */
export function buildTicketMessage(input: TicketMessageInput): string {
  const parts: string[] = [
    `🧾 *${input.shopName}* — Reçu de caisse`,
    `Réf : ${input.ref} · ${DATE_FMT.format(input.date)}`,
    "",
    ...input.lines.map((l) => `• ${l.name} × ${l.qty} — ${money(l.lineTotal)}`),
    "",
  ];
  const hasAnyDiscount = input.discount > 0 || input.promo !== null || input.pointsUsed !== null;
  if (hasAnyDiscount) parts.push(`Sous-total : ${money(input.subtotal)}`);
  if (input.discount > 0) parts.push(`Remise : −${money(input.discount)}`);
  if (input.promo) parts.push(`Code promo ${input.promo.code} : −${money(input.promo.discount)}`);
  if (input.pointsUsed) parts.push(`Points utilisés (${input.pointsUsed.points}) : −${money(input.pointsUsed.discount)}`);
  parts.push(`*Total payé : ${money(input.total)}* (${input.payLabel})`);
  if (input.loyalty) {
    parts.push(
      "",
      `⭐ Points gagnés : ${input.loyalty.pointsEarned} · Nouveau solde : ${input.loyalty.newBalance}`
    );
  }
  parts.push("", "Merci de votre visite ! 🧡");
  return parts.join("\n");
}
