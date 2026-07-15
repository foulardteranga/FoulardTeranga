"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { kycSchema, type KycInput } from "@/lib/validators/kyc";
import { orderEditSchema, type OrderEditInput } from "@/lib/validators/orderEdit";
import { buildOrderLines, type WebCartLineInput } from "./buildOrderLines";
import { aggregateQtyByProduct } from "./stockCheck";
import { money } from "@/lib/format";
import { applyLoyaltyOrder } from "@/lib/customers/applyLoyaltyOrder";
import { createNotification } from "@/lib/notifications/create";

/** Sous ce seuil de stock restant, une commande validée déclenche une alerte "stock bas". */
const LOW_STOCK_THRESHOLD = 3;

export async function submitWebOrder(
  kyc: KycInput,
  cartLines: WebCartLineInput[]
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const parsedKyc = kycSchema.safeParse(kyc);
  if (!parsedKyc.success) {
    return { ok: false, error: "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, id: { in: cartLines.map((l) => l.productId) } },
      });
      const built = buildOrderLines(cartLines, products);
      if (!built.ok) throw new Error(built.error);

      return tx.order.create({
        data: {
          tenantId: tenant.id,
          clientName: parsedKyc.data.name,
          place: parsedKyc.data.place,
          phone: parsedKyc.data.phone,
          channel: "Web",
          total: built.total,
          lines: { create: built.lines },
        },
      });
    }, { maxWait: 10000, timeout: 10000 });

    await createNotification({
      tenantId: tenant.id,
      type: "nouvelle_commande",
      title: "Nouvelle commande",
      body: `${order.ref} · ${order.clientName} · ${money(order.total)}`,
      href: "/admin/commandes",
    });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true, ref: order.ref };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known = message.startsWith("Produit introuvable") || message === "Quantité invalide." || message === "Le panier est vide.";
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}

export async function confirmOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id }, include: { lines: true } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "nouvelle") return { lowStock: [] as Array<{ name: string; stock: number }> }; // idempotent : déjà traitée

      // Agrégation par produit : une commande peut contenir plusieurs lignes
      // pour le même produit (variantes/longueurs différentes), donc vérifier
      // chaque ligne isolément contre le stock courant laisserait passer une
      // demande dont la somme dépasse le stock réel.
      const demand = aggregateQtyByProduct(order.lines);
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || product.stock < qty) {
          throw new Error(`Stock insuffisant pour ${nameAtOrder}.`);
        }
      }
      const lowStock: Array<{ name: string; stock: number }> = [];
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: qty } },
        });
        if (updated.stock <= LOW_STOCK_THRESHOLD) {
          lowStock.push({ name: nameAtOrder, stock: updated.stock });
        }
      }

      // Rattachement fidélité : miroir de la déduction de stock ci-dessus,
      // uniquement à la validation.
      const { customerId } = await applyLoyaltyOrder({
        tx,
        tenantId: tenant.id,
        orderTotal: order.total,
        clientName: order.clientName,
        phone: order.phone,
        place: order.place,
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "confirmee", customerId },
      });

      return { lowStock };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 });

    for (const product of result.lowStock) {
      await createNotification({
        tenantId: tenant.id,
        type: "stock_bas",
        title: "Stock bas",
        body: `${product.name} — ${product.stock} restant${product.stock > 1 ? "s" : ""}`,
        href: "/admin/inventaire",
      });
    }

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/clientes");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known = message === "Commande introuvable." || message.startsWith("Stock insuffisant pour ");
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}

export async function updateOrder(
  ref: string,
  input: OrderEditInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = orderEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();
    const order = await prisma.order.findFirst({ where: { ref, tenantId: tenant.id } });
    if (!order) return { ok: false, error: "Commande introuvable." };
    if (order.status !== "nouvelle") {
      return { ok: false, error: "Cette commande n'est plus modifiable." };
    }
    await prisma.order.update({
      where: { id: order.id },
      data: {
        clientName: parsed.data.clientName,
        place: parsed.data.place,
        phone: parsed.data.phone,
      },
    });
    revalidatePath("/admin/commandes");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function rejectOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const order = await prisma.order.findFirst({ where: { ref, tenantId: tenant.id } });
    if (!order) return { ok: false, error: "Commande introuvable." };
    if (order.status === "nouvelle") {
      await prisma.order.update({ where: { id: order.id }, data: { status: "refusee" } });
    }
    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
