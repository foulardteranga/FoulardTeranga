"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone, getSession } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { kycSchema, type KycInput } from "@/lib/validators/kyc";
import { orderEditSchema, type OrderEditInput } from "@/lib/validators/orderEdit";
import { buildOrderLines, type WebCartLineInput } from "./buildOrderLines";
import { aggregateQtyByProduct } from "./stockCheck";
import { money } from "@/lib/format";
import { applyLoyaltyOrder } from "@/lib/customers/applyLoyaltyOrder";
import { normalizePhone } from "@/lib/customers/normalizePhone";
import { createNotification } from "@/lib/notifications/create";
import { validatePromo, applyDiscounts } from "@/lib/discounts/engine";
import { getCustomerByProfileId } from "@/lib/data/customers.server";
import { findPromoByCode } from "@/lib/data/promos.server";
import { discountRequestSchema } from "@/lib/validators/discounts";
import { getOrderStatusHistory, type OrderStatusEventView } from "@/lib/data/orders.server";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/lowStockThreshold";

export async function submitWebOrder(
  kyc: KycInput,
  cartLines: WebCartLineInput[],
  discounts?: { promoCode?: string; pointsRequested?: number }
): Promise<{ ok: true; ref: string; id: string } | { ok: false; error: string }> {
  const parsedKyc = kycSchema.safeParse(kyc);
  if (!parsedKyc.success) {
    return { ok: false, error: "Informations invalides." };
  }
  // Entrée non fiable (client) : une remise mal formée n'est jamais une erreur
  // bloquante, elle dégrade simplement vers "aucune remise demandée".
  const parsedDiscounts = discountRequestSchema.safeParse(discounts ?? {});
  const safeDiscounts = parsedDiscounts.success ? parsedDiscounts.data : { pointsRequested: 0 };

  try {
    const tenant = await getCurrentTenant();

    // Contrôle séparé de requireWritableSession() (Tâche 17) : submitWebOrder
    // est le checkout public, appelé par une visiteuse anonyme sans session —
    // message neutre, pas de jargon « boutique suspendue » (cf. guard-coverage
    // EXEMPT, submitWebOrder n'appelle jamais requireWritableSession).
    if (tenant.status !== "active") {
      return { ok: false, error: "Cette boutique n'accepte plus de commandes pour le moment." };
    }

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, id: { in: cartLines.map((l) => l.productId) } },
      });
      const built = buildOrderLines(cartLines, products);
      if (!built.ok) throw new Error(built.error);

      // Remises DEMANDÉES : aperçu enregistré sur la commande, AUCUN débit
      // (ni points, ni compteur promo, ni stock) avant validation gérante.
      const session = await getSession();
      const customer =
        session && session.role === "customer" ? await getCustomerByProfileId(session.userId) : null;

      // La cliente à débiter au moment de la validation est retrouvée par
      // téléphone KYC (voir confirmOrder), pas par la session. Si la personne
      // connectée saisit le numéro d'une autre cliente, une intention de points
      // honorée ici débiterait le solde de CETTE AUTRE cliente à la validation.
      // On n'autorise donc les points que si le téléphone KYC est bien le sien.
      const sessionOwnsPhone =
        customer !== null && normalizePhone(parsedKyc.data.phone) === normalizePhone(customer.phone);

      let promoRow = null;
      if (safeDiscounts.promoCode?.trim()) {
        promoRow = await findPromoByCode(tx, tenant.id, safeDiscounts.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal: built.total,
          isVip: customer?.vip ?? false,
        });
        if (!verdict.ok) promoRow = null; // code devenu invalide : la demande part sans promo
      }
      const d = applyDiscounts({
        subtotal: built.total,
        promo: promoRow,
        pointsRequested: sessionOwnsPhone ? Math.max(0, Math.floor(safeDiscounts.pointsRequested ?? 0)) : 0,
        pointsBalance: customer?.points ?? 0,
      });

      const created = await tx.order.create({
        data: {
          tenantId: tenant.id,
          clientName: parsedKyc.data.name,
          place: parsedKyc.data.place,
          phone: parsedKyc.data.phone,
          channel: "Web",
          total: d.total,
          promoCode: promoRow && d.promoDiscount > 0 ? promoRow.code : null,
          promoDiscount: d.promoDiscount,
          pointsUsed: d.pointsUsed,
          pointsDiscount: d.pointsDiscount,
          lines: { create: built.lines },
        },
      });
      // Premier événement du journal de statut : pas d'auteur (créée par la cliente, pas de staff).
      await tx.orderStatusEvent.create({
        data: { tenantId: tenant.id, orderId: created.id, status: "nouvelle" },
      });
      return created;
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
    return { ok: true, ref: order.ref, id: order.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known = message.startsWith("Produit introuvable") || message === "Quantité invalide." || message === "Le panier est vide.";
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}

export async function confirmOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

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
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId,
            authorId: session.userId,
            delta: -qty,
            reason: "vente_web",
          },
        });
        if (updated.stock <= LOW_STOCK_THRESHOLD) {
          lowStock.push({ name: nameAtOrder, stock: updated.stock });
        }
      }

      // Remises : re-validation au moment de la validation (source de vérité).
      // Le sous-total vient des lignes ; la cliente est matchée par téléphone
      // normalisé (même règle que applyLoyaltyOrder) pour connaître solde et VIP.
      const subtotal = order.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const normalized = normalizePhone(order.phone);
      const candidates = await tx.customer.findMany({ where: { tenantId: tenant.id } });
      const matched = candidates.find((c) => normalizePhone(c.phone) === normalized) ?? null;

      let promoRow = null;
      if (order.promoCode) {
        promoRow = await findPromoByCode(tx, tenant.id, order.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal,
          isVip: matched?.vip ?? false,
        });
        if (!verdict.ok) promoRow = null; // code plus valide : commande validée SANS la remise promo
      }
      const d = applyDiscounts({
        subtotal,
        promo: promoRow,
        pointsRequested: order.pointsUsed, // l'intention enregistrée à la soumission
        pointsBalance: matched?.points ?? 0,
      });
      if (promoRow && d.promoDiscount > 0) {
        await tx.promoCode.update({ where: { id: promoRow.id }, data: { usedCount: { increment: 1 } } });
      }

      // Rattachement fidélité : miroir de la déduction de stock ci-dessus,
      // uniquement à la validation.
      const { customerId } = await applyLoyaltyOrder({
        tx,
        tenantId: tenant.id,
        orderTotal: d.total,
        clientName: order.clientName,
        phone: order.phone,
        place: order.place,
        pointsToDebit: d.pointsUsed,
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "confirmee",
          customerId,
          total: d.total,
          promoCode: promoRow && d.promoDiscount > 0 ? promoRow.code : order.promoCode,
          promoDiscount: d.promoDiscount,
          pointsUsed: d.pointsUsed,
          pointsDiscount: d.pointsDiscount,
        },
      });
      await tx.orderStatusEvent.create({
        data: { tenantId: tenant.id, orderId: order.id, authorId: session.userId, status: "confirmee" },
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

  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

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

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "nouvelle") return; // idempotent : déjà traitée
      await tx.order.update({ where: { id: order.id }, data: { status: "refusee" } });
      await tx.orderStatusEvent.create({
        data: { tenantId: tenant.id, orderId: order.id, authorId: session.userId, status: "refusee" },
      });
    });
    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return { ok: false, error: message === "Commande introuvable." ? message : "Une erreur est survenue, réessayez." };
  }
}

/** Fait passer une commande confirmée en préparation (staff, après validation). */
export async function markPreparing(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "confirmee") return; // idempotent : déjà traitée / statut différent
      await tx.order.update({ where: { id: order.id }, data: { status: "preparation" } });
      await tx.orderStatusEvent.create({
        data: { tenantId: tenant.id, orderId: order.id, authorId: session.userId, status: "preparation" },
      });
    });
    revalidatePath("/admin/commandes");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return { ok: false, error: message === "Commande introuvable." ? message : "Une erreur est survenue, réessayez." };
  }
}

/** Fait passer une commande en préparation à livrée (staff). */
export async function markDelivered(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "preparation") return; // idempotent : déjà traitée / statut différent
      await tx.order.update({ where: { id: order.id }, data: { status: "livree" } });
      await tx.orderStatusEvent.create({
        data: { tenantId: tenant.id, orderId: order.id, authorId: session.userId, status: "livree" },
      });
    });
    revalidatePath("/admin/commandes");
    revalidatePath("/confirmation");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return { ok: false, error: message === "Commande introuvable." ? message : "Une erreur est survenue, réessayez." };
  }
}

/** Wrapper client-callable (mirroring getProductStockMovements) : historique de statut d'une commande. */
export async function getOrderStatusHistoryAction(
  ref: string
): Promise<{ ok: true; events: OrderStatusEventView[] } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const events = await getOrderStatusHistory(ref);
  return { ok: true, events };
}
