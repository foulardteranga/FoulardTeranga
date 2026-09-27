import { createAdminClient } from "@/lib/supabase/admin";
import { STOREFRONT_IMAGES_BUCKET } from "./imageUpload";

/**
 * Extrait le chemin relatif d'une URL de stockage Supabase pour un tenant donné.
 * Retourne le chemin relatif si l'URL appartient au bucket et respecte l'isolation du tenant.
 * Retourne null si l'URL est externe ou invalide.
 */
export function extractTenantStoragePath(imageUrl: string, tenantId: string): string | null {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return null;
  }

  const bucketMarker = `/${STOREFRONT_IMAGES_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(bucketMarker);
  if (markerIndex === -1) {
    return null;
  }

  const relativePath = decodeURIComponent(
    imageUrl.substring(markerIndex + bucketMarker.length).split("?")[0]
  );

  // Contrôle d'isolation tenant : le chemin doit commencer par l'id du tenant courant
  if (!relativePath.startsWith(`${tenantId}/`)) {
    return null;
  }

  return relativePath;
}

/**
 * Supprime un ensemble d'images du bucket Supabase Storage en respectant l'isolation du tenant.
 * Ignore silencieusement les images externes ou qui n'appartiennent pas au tenant.
 */
export async function removeTenantStorageFiles(
  tenantId: string,
  imageUrls: (string | null | undefined)[]
): Promise<{ ok: boolean; deletedCount: number; error?: string }> {
  const pathsToDelete: string[] = [];

  for (const url of imageUrls) {
    if (!url) continue;
    const path = extractTenantStoragePath(url, tenantId);
    if (path && !pathsToDelete.includes(path)) {
      pathsToDelete.push(path);
    }
  }

  if (pathsToDelete.length === 0) {
    return { ok: true, deletedCount: 0 };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(STOREFRONT_IMAGES_BUCKET).remove(pathsToDelete);
    if (error) {
      console.error("[removeTenantStorageFiles] Erreur de suppression storage:", error);
      return { ok: false, deletedCount: 0, error: "Échec de la suppression dans le stockage." };
    }
    return { ok: true, deletedCount: pathsToDelete.length };
  } catch (err) {
    console.error("[removeTenantStorageFiles] Exception:", err);
    return { ok: false, deletedCount: 0, error: "Une erreur est survenue lors de la suppression." };
  }
}
