"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { requireWritableSession, READ_ONLY_ERROR } from "@/lib/impersonation/guards";
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
  if (!(await requireWritableSession())) return { ok: false, error: READ_ONLY_ERROR };

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
  if (!(await requireWritableSession())) return { ok: false, error: READ_ONLY_ERROR };

  try {
    const tenant = await getCurrentTenant();
    const row = await prisma.storefrontPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: SLUG } },
    });
    const draft = (row ? row.draft : defaultPage()) as unknown as Prisma.InputJsonValue;
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
  if (!(await requireWritableSession())) return { ok: false, error: READ_ONLY_ERROR };

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
  if (!(await requireWritableSession())) return { ok: false, error: READ_ONLY_ERROR };

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
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
