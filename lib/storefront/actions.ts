"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { pageContentSchema, parsePageContent, defaultPage } from "./pageContent";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "@/lib/images/imageUpload";

const SLUG = "home";

/** Enregistre le brouillon (autosave). Valide le contenu côté serveur. */
export async function saveDraft(
  content: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = pageContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: "Contenu invalide." };
  const draft = parsePageContent(parsed.data); // normalise (filtre types inconnus)

  try {
    const tenant = await getCurrentTenant();
    await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
      update: { draft: draft as unknown as Prisma.InputJsonValue },
      create: {
        tenantId: tenant.id,
        slug: SLUG,
        draft: draft as unknown as Prisma.InputJsonValue,
        published: defaultPage() as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/admin/vitrine");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Publie : copie draft → published. */
export async function publish(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    const row = await prisma.storefrontPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
    });
    const draft = (row ? row.draft : defaultPage()) as unknown as Prisma.InputJsonValue;
    const pageDraft = parsePageContent(draft);
    const invalidHero = pageDraft.blocks.find((b) => {
      if (b.type !== "hero" || !b.visible) return false;
      const imgs = (b.settings as { images?: string[] }).images;
      return Array.isArray(imgs) && imgs.length > 0 && imgs.length < 5;
    });
    if (invalidHero) {
      const count = ((invalidHero.settings as { images?: string[] }).images || []).length;
      return {
        ok: false,
        error: `Impossible de publier : le bloc « ${invalidHero.name} » nécessite au moins 5 images pour la bande déroulante (actuellement ${count}/10).`,
      };
    }

    await prisma.storefrontPage.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
      update: { published: draft, publishedAt: new Date() },
      create: { tenantId: tenant.id, slug: SLUG, draft, published: draft, publishedAt: new Date() },
    });
    revalidatePath("/");
    revalidatePath("/admin/vitrine");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Annule les modifications : copie published → draft. */
export async function revertDraft(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    const row = await prisma.storefrontPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
    });
    if (!row) return { ok: true }; // rien à annuler
    await prisma.storefrontPage.update({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
      data: { draft: row.published as unknown as Prisma.InputJsonValue },
    });
    revalidatePath("/admin/vitrine");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Upload une image de bloc vers Supabase Storage, compressée côté serveur. */
export async function uploadBlockImage(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const file = formData.get("file");
  const blockType = formData.get("blockType");
  const fieldKey = formData.get("fieldKey");
  if (!(file instanceof File) || typeof blockType !== "string" || typeof fieldKey !== "string") {
    return { ok: false, error: "Requête invalide." };
  }

  const validation = validateImageUpload(file);
  if (!validation.ok) return validation;

  try {
    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(raw);
    const tenant = await getCurrentTenant();
    const path = `${tenant.id}/${blockType}/${fieldKey}-${randomUUID()}.webp`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(STOREFRONT_IMAGES_BUCKET)
      .upload(path, compressed, { contentType: "image/webp", upsert: false });
    if (uploadError) return { ok: false, error: "Une erreur est survenue, réessayez." };

    const { data } = supabase.storage.from(STOREFRONT_IMAGES_BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    console.error("[uploadBlockImage] Échec du traitement de l'image:", err);
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

/** Supprime une image de bloc du stockage Supabase Storage. */
export async function deleteBlockImage(
  imageUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return { ok: true };
  }

  try {
    const tenant = await getCurrentTenant();
    const bucketMarker = `/${STOREFRONT_IMAGES_BUCKET}/`;
    const markerIndex = imageUrl.indexOf(bucketMarker);
    if (markerIndex === -1) {
      // Image externe ou chemin non issu du bucket storefront-images
      return { ok: true };
    }

    const relativePath = decodeURIComponent(
      imageUrl.substring(markerIndex + bucketMarker.length).split("?")[0]
    );

    // Contrôle d'isolation tenant : le chemin doit commencer par l'id du tenant courant
    if (!relativePath.startsWith(`${tenant.id}/`)) {
      return { ok: false, error: "Action non autorisée." };
    }

    const supabase = await createClient();
    const { error } = await supabase.storage.from(STOREFRONT_IMAGES_BUCKET).remove([relativePath]);
    if (error) {
      return { ok: false, error: "Échec de la suppression dans le stockage." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

