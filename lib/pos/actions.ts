"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { posSaleSchema, type PosSaleInput } from "@/lib/validators/pos";
import { buildOrderLines } from "@/lib/orders/buildOrderLines";
import { aggregateQtyByProduct } from "@/lib/orders/stockCheck";
import { applyLoyaltyOrder } from "@/lib/customers/applyLoyaltyOrder";
import { validatePromo, applyDiscounts } from "@/lib/discounts/engine";
import { findPromoByCode } from "@/lib/data/promos.server";

export interface PosTicketData {
  shopName: string;
  lines: Array<{ name: string; qty: number; lineTotal: number }>;
  subtotal: number;
  discount: number;
  total: number;
  customerPhone: string | null;
  loyalty: { pointsEarned: number; newBalance: number } | null;
  promo: { code: string; discount: number } | null;
  pointsUsed: { points: number; discount: number } | null;
}

export async function encaisserVente(
  input: PosSaleInput
): Promise<{ ok: true; ref: string; ticket: PosTicketData } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, id: { in: parsed.data.lines.map((l) => l.productId) } },
      });
      const built = buildOrderLines(parsed.data.lines, products);
      if (!built.ok) throw new Error(built.error);

      const demand = aggregateQtyByProduct(built.lines);
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const product = products.find((p) => p.id === productId);
        if (!product || product.stock < qty) {
          throw new Error(`Stock insuffisant pour ${nameAtOrder}.`);
        }
      }
      for (const [productId, { qty }] of demand) {
        await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } });
      }

      // Cliente rattachée (facultative) — lue d'abord : ses points/statut VIP
      // conditionnent les remises.
      let customer: Awaited<ReturnType<typeof tx.customer.findFirst>> = null;
      if (parsed.data.customerId) {
        customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, tenantId: tenant.id },
        });
        if (!customer) throw new Error("Cliente introuvable.");
      }

      // Remises : code promo (validé serveur, erreur bloquante si invalide) puis points.
      let promoRow = null;
      if (parsed.data.promoCode) {
        promoRow = await findPromoByCode(tx, tenant.id, parsed.data.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal: built.total,
          isVip: customer?.vip ?? false,
        });
        if (!verdict.ok) throw new Error(`Code promo : ${verdict.reason}.`);
      }
      const discounts = applyDiscounts({
        subtotal: built.total,
        promo: promoRow,
        pointsRequested: customer ? parsed.data.pointsRequested : 0,
        pointsBalance: customer?.points ?? 0,
      });
      if (promoRow && discounts.promoDiscount > 0) {
        await tx.promoCode.update({
          where: { id: promoRow.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      let clientName = "Client comptoir";
      let phone = "";
      let place = "Vente en boutique";
      let customerId: string | null = null;
      let vipAtOrder = false;
      let loyaltyInfo: { pointsEarned: number; newBalance: number } | null = null;

      if (customer) {
        const loyalty = await applyLoyaltyOrder({
          tx,
          tenantId: tenant.id,
          orderTotal: discounts.total, // points gagnés sur le montant réellement payé
          customerId: customer.id,
          pointsToDebit: discounts.pointsUsed,
        });
        customerId = loyalty.customerId;
        vipAtOrder = loyalty.vipBefore;
        loyaltyInfo = { pointsEarned: loyalty.pointsEarned, newBalance: loyalty.newBalance };
        clientName = customer.name;
        phone = customer.phone;
        place = customer.place;
      }

      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          clientName,
          place,
          phone,
          channel: "Boutique",
          status: "livree",
          paymentMethod: parsed.data.paymentMethod,
          vipAtOrder,
          customerId,
          total: discounts.total,
          promoCode: promoRow && discounts.promoDiscount > 0 ? promoRow.code : null,
          promoDiscount: discounts.promoDiscount,
          pointsUsed: discounts.pointsUsed,
          pointsDiscount: discounts.pointsDiscount,
          lines: { create: built.lines },
        },
      });

      return { order, built, phone, loyaltyInfo, discounts, promoRow };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/clientes");
    return {
      ok: true,
      ref: result.order.ref,
      ticket: {
        shopName: tenant.name,
        lines: result.built.lines.map((l) => ({
          name: l.nameAtOrder,
          qty: l.qty,
          lineTotal: l.unitPrice * l.qty,
        })),
        subtotal: result.built.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0),
        discount: result.built.lines.reduce((a, l) => a + l.discount * l.qty, 0),
        total: result.discounts.total,
        customerPhone: result.phone || null,
        loyalty: result.loyaltyInfo,
        promo:
          result.promoRow && result.discounts.promoDiscount > 0
            ? { code: result.promoRow.code, discount: result.discounts.promoDiscount }
            : null,
        pointsUsed:
          result.discounts.pointsUsed > 0
            ? { points: result.discounts.pointsUsed, discount: result.discounts.pointsDiscount }
            : null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known =
      message.startsWith("Produit introuvable") ||
      message === "Quantité invalide." ||
      message === "Le panier est vide." ||
      message.startsWith("Stock insuffisant pour ") ||
      message === "Cliente introuvable." ||
      message.startsWith("Code promo : ");
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
