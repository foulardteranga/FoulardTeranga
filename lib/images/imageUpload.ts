import sharp from "sharp";

export const STOREFRONT_IMAGES_BUCKET = "storefront-images";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo brut, avant compression

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 82;

export function validateImageUpload(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return { ok: false, error: "Format non supporté (JPEG, PNG ou WebP uniquement)." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (10 Mo maximum)." };
  }
  return { ok: true };
}

/** Redimensionne (largeur max 1920px, pas d'agrandissement) et convertit en WebP. */
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(MAX_WIDTH, undefined, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
