import type { Prisma } from "@/lib/generated/prisma/client";
import { initials } from "@/lib/format";
import { normalizePhone } from "./normalizePhone";
import { computeLoyaltyStatus, pointsEarnedFor } from "./loyalty";

export interface ApplyLoyaltyOrderParams {
  tx: Prisma.TransactionClient;
  tenantId: string;
  orderTotal: number;
  /** Cliente déjà connue (vente POS) — ne met à jour que ses compteurs de fidélité, ni nom ni lieu. */
  customerId?: string | null;
  /** Utilisés uniquement quand `customerId` est absent (commande web) : matching par téléphone normalisé, création si aucune correspondance. */
  clientName?: string;
  phone?: string;
  place?: string;
  /** Points à débiter du solde dans la même transaction (0 = aucun débit). */
  pointsToDebit: number;
}

/**
 * Rattache une commande (web validée ou vente POS) à une fiche cliente et
 * met à jour ses compteurs de fidélité (`computeLoyaltyStatus`, `pointsEarnedFor`).
 * `vipBefore` renvoie le statut VIP de la cliente **avant** cette commande —
 * utile pour un snapshot `Order.vipAtOrder` fiable côté appelant.
 */
export async function applyLoyaltyOrder(
  params: ApplyLoyaltyOrderParams
): Promise<{ customerId: string; vipBefore: boolean; pointsEarned: number; newBalance: number }> {
  const { tx, tenantId, orderTotal } = params;

  if (params.customerId) {
    const existing = await tx.customer.findUniqueOrThrow({ where: { id: params.customerId } });
    const newOrdersCount = existing.ordersCount + 1;
    const newTotalSpent = existing.totalSpent + orderTotal;
    const earned = pointsEarnedFor(orderTotal);
    const newBalance = Math.max(0, existing.points + earned - params.pointsToDebit);
    const { vip, segment } = computeLoyaltyStatus(newTotalSpent, newOrdersCount);
    const updated = await tx.customer.update({
      where: { id: existing.id },
      data: { ordersCount: newOrdersCount, totalSpent: newTotalSpent, points: newBalance, vip, segment },
    });
    return { customerId: updated.id, vipBefore: existing.vip, pointsEarned: earned, newBalance };
  }

  const clientName = params.clientName ?? "";
  const phone = params.phone ?? "";
  const place = params.place ?? "";
  const normalizedPhone = normalizePhone(phone);
  const candidates = await tx.customer.findMany({ where: { tenantId } });
  const existing = candidates.find((c) => normalizePhone(c.phone) === normalizedPhone);

  const newOrdersCount = (existing?.ordersCount ?? 0) + 1;
  const newTotalSpent = (existing?.totalSpent ?? 0) + orderTotal;
  const earned = pointsEarnedFor(orderTotal);
  const newBalance = Math.max(0, (existing?.points ?? 0) + earned - params.pointsToDebit);
  const { vip, segment } = computeLoyaltyStatus(newTotalSpent, newOrdersCount);

  const customer = existing
    ? await tx.customer.update({
        where: { id: existing.id },
        data: {
          name: clientName,
          place,
          ordersCount: newOrdersCount,
          totalSpent: newTotalSpent,
          points: newBalance,
          vip,
          segment,
        },
      })
    : await tx.customer.create({
        data: {
          tenantId,
          name: clientName,
          initials: initials(clientName),
          phone,
          place,
          ordersCount: newOrdersCount,
          totalSpent: newTotalSpent,
          points: newBalance,
          vip,
          segment,
        },
      });

  return {
    customerId: customer.id,
    vipBefore: existing?.vip ?? false,
    pointsEarned: earned,
    newBalance,
  };
}
