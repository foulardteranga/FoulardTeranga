"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "@/lib/images/imageUpload";
import { productSchema, productImagesSchema, type ProductInput } from "@/lib/validators/product";

export async function createProduct(
  input: ProductInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  const lengths = parsed.data.lengths
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const tenant = await getCurrentTenant();
  await prisma.product.create({
    data: {
      tenantId: tenant.id,
      category: parsed.data.category,
      name: parsed.data.name,
      variant: parsed.data.variant,
      motif: parsed.data.motif,
      price: parsed.data.price,
      stock: parsed.data.stock,
      swatch: parsed.data.swatch,
      colors: [parsed.data.swatch],
      lengths: lengths.length ? lengths : ["Taille unique"],
      description: parsed.data.description,
      image: parsed.data.image ?? null,
      gallery: parsed.data.gallery,
    },
  });

  revalidatePath("/admin/inventaire");
  revalidatePath("/");
  revalidatePath("/catalogue");
  return { ok: true };
}

/** Upload une photo produit vers Supabase Storage, compressée côté serveur. */
export async function uploadProductImage(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

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
