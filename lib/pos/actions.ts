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

export interface PosTicketData {
  shopName: string;
  lines: Array<{ name: string; qty: number; lineTotal: number }>;
  subtotal: number;
  discount: number;
  total: number;
  customerPhone: string | null;
  loyalty: { pointsEarned: number; newBalance: number } | null;
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

      let clientName = "Client comptoir";
      let phone = "";
      let place = "Vente en boutique";
      let customerId: string | null = null;
      let vipAtOrder = false;
      let loyaltyInfo: { pointsEarned: number; newBalance: number } | null = null;

      if (parsed.data.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: parsed.data.customerId, tenantId: tenant.id },
        });
        if (!customer) throw new Error("Cliente introuvable.");
        const loyalty = await applyLoyaltyOrder({
          tx,
          tenantId: tenant.id,
          orderTotal: built.total,
          customerId: customer.id,
        });
        customerId = loyalty.customerId;
        vipAtOrder = loyalty.vipBefore;
        clientName = customer.name;
        phone = customer.phone;
        place = customer.place;
        loyaltyInfo = { pointsEarned: loyalty.pointsEarned, newBalance: loyalty.newBalance };
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
          total: built.total,
          lines: { create: built.lines },
        },
      });

      return { order, built, phone, loyaltyInfo };
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
        total: result.built.total,
        customerPhone: result.phone || null,
        loyalty: result.loyaltyInfo,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known =
      message.startsWith("Produit introuvable") ||
      message === "Quantité invalide." ||
      message === "Le panier est vide." ||
      message.startsWith("Stock insuffisant pour ") ||
      message === "Cliente introuvable.";
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
