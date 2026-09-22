"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "@/lib/images/imageUpload";
import { z } from "zod";
import { productSchema, productImagesSchema, productVariantInputSchema, type ProductInput, type ProductVariantInput } from "@/lib/validators/product";
import { stockAdjustmentSchema, type StockAdjustmentInput } from "@/lib/validators/stockMovement";
import { getRecentStockMovements, type StockMovementView } from "@/lib/data/stockMovements.server";

export async function createProduct(
  input: ProductInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  const lengths = parsed.data.lengths
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const rawVariants = parsed.data.variants;
  const variants = rawVariants.length > 0
    ? rawVariants
    : [
        {
          colorName: "Couleur unique",
          colorHex: parsed.data.swatch,
          stock: parsed.data.stock,
          active: true,
          position: 0,
        },
      ];

  const totalStock = variants.filter((v) => v.active).reduce((sum, v) => sum + v.stock, 0);
  const colorsList = Array.from(new Set(variants.map((v) => v.colorHex)));
  const primarySwatch = variants[0]?.colorHex ?? parsed.data.swatch;

  try {
    const tenant = await getCurrentTenant();
    const createdId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId: tenant.id,
          category: parsed.data.category,
          name: parsed.data.name,
          variant: parsed.data.variant,
          motif: parsed.data.motif,
          price: parsed.data.price,
          stock: totalStock,
          swatch: primarySwatch,
          colors: colorsList.length > 0 ? colorsList : [primarySwatch],
          lengths: lengths.length ? lengths : ["Taille unique"],
          description: parsed.data.description,
          image: parsed.data.image ?? null,
          gallery: parsed.data.gallery,
        },
      });

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        await tx.productVariant.create({
          data: {
            productId: product.id,
            colorName: v.colorName,
            colorHex: v.colorHex,
            stock: v.stock,
            sku: v.sku ?? null,
            image: v.image ?? null,
            active: v.active,
            position: v.position ?? i,
          },
        });
      }

      return product.id;
    });

    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/pos");
    revalidatePath("/");
    revalidatePath("/catalogue");
    return { ok: true, id: createdId };
  } catch {
    return { ok: false, error: "Une erreur est survenue lors de la création du produit." };
  }
}

/** Met à jour les variantes d'un produit (stock par couleur, teintes, photos dédiées) */
export async function updateProductVariants(
  productId: string,
  variantsInput: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = z.array(productVariantInputSchema).safeParse(variantsInput);
  if (!parsed.success) return { ok: false, error: "Variantes invalides." };

  try {
    const tenant = await getCurrentTenant();
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: tenant.id },
      include: { variants: true },
    });
    if (!product) return { ok: false, error: "Produit introuvable." };

    const variants = parsed.data;
    const totalStock = variants.filter((v) => v.active).reduce((sum, v) => sum + v.stock, 0);
    const colorsList = Array.from(new Set(variants.map((v) => v.colorHex)));
    const primarySwatch = variants[0]?.colorHex ?? product.swatch;

    await prisma.$transaction(async (tx) => {
      const existingIds = new Set(product.variants.map((v) => v.id));
      const incomingIds = new Set(variants.map((v) => v.id).filter(Boolean));

      // Supprimer les variantes retirées
      const toDelete = product.variants.filter((v) => !incomingIds.has(v.id)).map((v) => v.id);
      if (toDelete.length > 0) {
        await tx.productVariant.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Upsert des variantes
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (v.id && existingIds.has(v.id)) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              colorName: v.colorName,
              colorHex: v.colorHex,
              stock: v.stock,
              sku: v.sku ?? null,
              image: v.image ?? null,
              active: v.active,
              position: v.position ?? i,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: product.id,
              colorName: v.colorName,
              colorHex: v.colorHex,
              stock: v.stock,
              sku: v.sku ?? null,
              image: v.image ?? null,
              active: v.active,
              position: v.position ?? i,
            },
          });
        }
      }

      // Synchroniser le produit parent
      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: totalStock,
          swatch: primarySwatch,
          colors: colorsList.length > 0 ? colorsList : [primarySwatch],
        },
      });
    });

    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/pos");
    revalidatePath("/");
    revalidatePath("/catalogue");
    revalidatePath(`/produit/${productId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue lors de la mise à jour des variantes." };
  }
}

/** Upload une photo produit vers Supabase Storage, compressée côté serveur. */
export async function uploadProductImage(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Requête invalide." };

  const validation = validateImageUpload(file);
  if (!validation.ok) return validation;

  try {
    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(raw);
    const tenant = await getCurrentTenant();
    const path = `${tenant.id}/products/${randomUUID()}.webp`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(STOREFRONT_IMAGES_BUCKET)
      .upload(path, compressed, { contentType: "image/webp", upsert: false });
    if (uploadError) return { ok: false, error: "Une erreur est survenue, réessayez." };

    const { data } = supabase.storage.from(STOREFRONT_IMAGES_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Remplace les photos (principale + galerie) d'un produit du tenant courant. */
export async function updateProductImages(
  productId: string,
  images: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = productImagesSchema.safeParse(images);
  if (!parsed.success) return { ok: false, error: "Photos invalides." };

  try {
    const tenant = await getCurrentTenant();
    const { count } = await prisma.product.updateMany({
      where: { id: productId, tenantId: tenant.id },
      data: { image: parsed.data.image, gallery: parsed.data.gallery },
    });
    if (count === 0) return { ok: false, error: "Produit introuvable." };

    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/pos");
    revalidatePath("/");
    revalidatePath("/catalogue");
    revalidatePath(`/produit/${productId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Ajustement manuel de stock (réception, perte/casse, correction d'inventaire). */
export async function adjustStock(
  input: StockAdjustmentInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();

    await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: parsed.data.productId, tenantId: tenant.id },
        });
        if (!product) throw new Error("Produit introuvable.");

        if (parsed.data.variantId) {
          const variant = await tx.productVariant.findFirst({
            where: { id: parsed.data.variantId, productId: product.id },
          });
          if (!variant) throw new Error("Variante introuvable.");

          const nextVariantStock = variant.stock + parsed.data.delta;
          if (nextVariantStock < 0) {
            throw new Error(`Stock insuffisant pour cette variante — stock actuel : ${variant.stock}.`);
          }

          await tx.productVariant.update({
            where: { id: variant.id },
            data: { stock: { increment: parsed.data.delta } },
          });
        }

        const nextStock = product.stock + parsed.data.delta;
        if (nextStock < 0) {
          throw new Error(`Stock insuffisant pour cet ajustement — stock actuel : ${product.stock}.`);
        }

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: parsed.data.delta } },
        });
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            variantId: parsed.data.variantId ?? null,
            authorId: session.userId,
            delta: parsed.data.delta,
            reason: parsed.data.reason,
            note: parsed.data.note || undefined,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 }
    );

    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/pos");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known =
      message === "Produit introuvable." || message.startsWith("Stock insuffisant pour cet ajustement");
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}

/**
 * Lecture des mouvements de stock d'un produit, appelée depuis le tiroir
 * produit (Client Component ouvert dynamiquement — pas de prop serveur par
 * produit) : même pattern que `previewPosDiscount` dans PosScreen.tsx.
 */
export async function getProductStockMovements(
  productId: string
): Promise<{ ok: true; movements: StockMovementView[] } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const movements = await getRecentStockMovements(productId);
    return { ok: true, movements };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
