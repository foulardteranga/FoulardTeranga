import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compressImage,
  validateImageUpload,
  STOREFRONT_IMAGES_BUCKET,
} from "@/lib/images/imageUpload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { allowed } = await requireZone("dashboard");
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "Action non autorisée (droits insuffisants)." },
        { status: 403 }
      );
    }

    const writable = await requireWritableSession();
    if (!writable.ok) {
      return NextResponse.json({ ok: false, error: writable.error }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Fichier manquant." }, { status: 400 });
    }

    const validation = validateImageUpload(file);
    if (!validation.ok) {
      return NextResponse.json(validation, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressImage(raw);
    const tenant = await getCurrentTenant();
    const path = `${tenant.id}/products/${randomUUID()}.webp`;

    let supabase = createAdminClient();
    let { error: uploadError } = await supabase.storage
      .from(STOREFRONT_IMAGES_BUCKET)
      .upload(path, compressed, { contentType: "image/webp", upsert: false });

    if (uploadError) {
      console.warn("[api/inventory/upload-image] Essai repli client standard suite à:", uploadError);
      supabase = await createClient();
      const retry = await supabase.storage
        .from(STOREFRONT_IMAGES_BUCKET)
        .upload(path, compressed, { contentType: "image/webp", upsert: false });
      uploadError = retry.error;
    }

    if (uploadError) {
      console.error("[api/inventory/upload-image] Échec du stockage Supabase:", uploadError);
      return NextResponse.json(
        { ok: false, error: `Erreur stockage Supabase : ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(STOREFRONT_IMAGES_BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    console.error("[api/inventory/upload-image] Exception non gérée:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur inattendue";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
