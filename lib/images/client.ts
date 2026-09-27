/**
 * Utilitaires client pour le traitement et l'optimisation des images avant upload.
 */

/**
 * Prépare et compresse une image côté client avant envoi vers le serveur.
 * Convertit en WebP, redimensionne si les dimensions dépassent `maxDimension` (1440px par défaut),
 * et garantit un fichier léger (< 400 Ko) pour contourner les limites de taille de payload Vercel / Server Actions.
 */
export async function prepareImageForUpload(
  file: File,
  maxDimension = 1440,
  quality = 0.82
): Promise<File> {
  // Dans un environnement SSR ou test sans API Image/Canvas, retourner le fichier brut
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  // Si l'image est déjà petite (< 250 Ko) et en WebP, pas besoin de retraiter
  if (file.size < 250 * 1024 && file.type === "image/webp") {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        resolve(file);
        return;
      }

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const cleanName = file.name.replace(/\.[^.]+$/, "") + ".webp";
          const optimized = new File([blob], cleanName, {
            type: "image/webp",
            lastModified: Date.now(),
          });
          resolve(optimized);
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Téléverse une image de bloc vitrine via la Route Handler dédiée.
 * Évite les soucis de sérialisation multipart / Server Components sur Vercel.
 */
export async function uploadBlockImageClient(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/storefront/upload-image", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) {
      return { ok: false, error: data?.error || `Erreur lors du téléversement (${res.status})` };
    }
    return { ok: true, url: data.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur de connexion lors du téléversement",
    };
  }
}

/**
 * Téléverse une photo produit via la Route Handler dédiée.
 */
export async function uploadProductImageClient(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/inventory/upload-image", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) {
      return { ok: false, error: data?.error || `Erreur lors du téléversement (${res.status})` };
    }
    return { ok: true, url: data.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur de connexion lors du téléversement",
    };
  }
}
