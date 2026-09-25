"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import type { FieldDescriptor } from "@/lib/storefront/blockSettings";
import type { BlockId } from "@/lib/storefront/blockIds";
import { uploadBlockImage, deleteBlockImage } from "@/lib/storefront/actions";
import { NumericField } from "@/components/ui/NumericField";
import { useBackoffice } from "@/lib/store/useBackoffice";

const miniBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 34,
  padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 8,
  background: "#fff",
  color: colors.primary,
  font: `600 12px ${fonts.ui}`,
};

const tinyBtnStyle: React.CSSProperties = {
  height: 26,
  padding: "0 8px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 6,
  background: "#fff",
  color: colors.primary,
  font: `600 11px ${fonts.ui}`,
  cursor: "pointer",
};

function moveItem(arr: string[], from: number, to: number): string[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/**
 * Optimise et compresse l'image côté client avant téléversement.
 * Évite les transferts massifs (ex. 8 photos smartphone à 5-8 Mo = 50 Mo),
 * prévient les erreurs 413 Payload Too Large et accélère le traitement.
 */
async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined" || !window.document) {
    return file;
  }

  // Si l'image est déjà petite (< 600 Ko) dans un format Web direct, pas besoin de retraiter
  if (file.size < 600 * 1024 && (file.type === "image/webp" || file.type === "image/jpeg" || file.type === "image/png")) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIMENSION = 1920;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        resolve(file);
        return;
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
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
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

export function SettingsField({
  field,
  value,
  onChange,
  blockType,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  blockType: BlockId;
}) {
  const showToast = useBackoffice((s) => s.showToast);
  const [uploading, setUploading] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadAndApply(file: File, apply: (url: string) => void) {
    setUploading(true);
    setError(null);
    setUploadProgress({
      current: 1,
      total: 1,
      percent: 25,
      label: "Optimisation de l'image…",
    });

    try {
      const preparedFile = await prepareImageForUpload(file);

      setUploadProgress({
        current: 1,
        total: 1,
        percent: 60,
        label: "Téléversement et compression…",
      });

      const formData = new FormData();
      formData.append("file", preparedFile);
      formData.append("blockType", blockType);
      formData.append("fieldKey", field.key);

      const res = await uploadBlockImage(formData);
      if (!res.ok) {
        setError(res.error);
        showToast(res.error || "Échec du téléversement", "error");
        return;
      }

      setUploadProgress({
        current: 1,
        total: 1,
        percent: 100,
        label: "Image téléversée !",
      });

      const oldUrl = typeof value === "string" ? value : "";
      if (oldUrl && oldUrl !== res.url) {
        deleteBlockImage(oldUrl).catch(console.error);
      }

      apply(res.url);
      showToast("Image téléversée et compressée avec succès", "success");
    } catch (err: unknown) {
      console.error("Erreur uploadAndApply:", err);
      const msg = err instanceof Error ? err.message : "Erreur de téléversement";
      setError(`Erreur lors de l'envoi de l'image : ${msg}`);
      showToast(`Erreur d'envoi : ${msg}`, "error");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 500);
    }
  }

  const label = (
    <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
      {field.label}
    </label>
  );
  const base: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    border: `1.5px solid ${colors.borderField}`,
    borderRadius: 9,
    font: `400 13.5px ${fonts.ui}`,
    outline: "none",
  };

  // Composant visuel pour la barre de progression
  const progressBar = uploadProgress && (
    <div
      style={{
        margin: "8px 0",
        padding: "8px 12px",
        background: "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)",
        border: "1px solid #A7F3D0",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 11.5,
          fontWeight: 600,
          color: "#065F46",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
            }}
          />
          {uploadProgress.label}
        </span>
        <span>{uploadProgress.percent}%</span>
      </div>
      <div
        style={{
          width: "100%",
          height: 6,
          background: "#D1FAE5",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${uploadProgress.percent}%`,
            height: "100%",
            background: "linear-gradient(90deg, #10B981 0%, #059669 100%)",
            borderRadius: 999,
            transition: "width 0.25s ease-out",
          }}
        />
      </div>
    </div>
  );

  if (field.kind === "image") {
    const url = typeof value === "string" ? value : "";

    async function handleRemoveSingle() {
      if (url) {
        onChange("");
        showToast("Image supprimée du stockage", "success");
        try {
          await deleteBlockImage(url);
        } catch (e) {
          console.error("Erreur suppression image Supabase:", e);
        }
      }
    }

    return (
      <div style={{ marginBottom: 14 }}>
        {label}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 9, marginBottom: 8 }} />
        ) : (
          <div style={{ width: "100%", height: 90, border: `1.5px dashed ${colors.borderField}`, borderRadius: 9, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: colors.muted }}>
            Aucune image
          </div>
        )}

        {progressBar}

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
            {uploading ? "Envoi en cours…" : url ? "Remplacer" : "Choisir une image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadAndApply(f, (u) => onChange(u));
              }}
              style={{ display: "none" }}
            />
          </label>
          {url && (
            <button type="button" onClick={handleRemoveSingle} disabled={uploading} style={miniBtnStyle}>
              Retirer
            </button>
          )}
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
      </div>
    );
  }

  async function uploadMultipleAndApply(files: File[], apply: (urls: string[]) => void) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    const total = files.length;
    const uploadedUrls: string[] = [];

    // Validation préventive côté client
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) {
        setError(`Le fichier "${f.name}" est trop volumineux (taille max 15 Mo).`);
        showToast(`"${f.name}" dépasse 15 Mo`, "error");
        setUploading(false);
        return;
      }
    }

    try {
      for (let i = 0; i < total; i++) {
        const file = files[i];
        const current = i + 1;
        const startPercent = Math.round(((current - 1) / total) * 100);

        setUploadProgress({
          current,
          total,
          percent: startPercent,
          label: `Optimisation ${current} / ${total} (${file.name})…`,
        });

        try {
          // Optimise côté client avant envoi pour transfert ultra-léger et rapide
          const preparedFile = await prepareImageForUpload(file);

          const formData = new FormData();
          formData.append("file", preparedFile);
          formData.append("blockType", blockType);
          formData.append("fieldKey", field.key);

          const res = await uploadBlockImage(formData);

          if (!res.ok) {
            setError(res.error);
            showToast(`Erreur sur l'image ${current}/${total} : ${res.error}`, "error");
            continue; // Permet de conserver les autres images
          }

          const endPercent = Math.round((current / total) * 100);
          setUploadProgress({
            current,
            total,
            percent: endPercent,
            label: `Image ${current} / ${total} prête (${endPercent}%)`,
          });
          uploadedUrls.push(res.url);
        } catch (itemErr: unknown) {
          console.error(`Erreur upload image ${current}:`, itemErr);
          const msg = itemErr instanceof Error ? itemErr.message : "Erreur de connexion";
          setError(`Erreur sur l'image ${current} (${file.name}) : ${msg}`);
          showToast(`Erreur sur ${file.name} : ${msg}`, "error");
        }
      }

      if (uploadedUrls.length > 0) {
        apply(uploadedUrls);
        showToast(`${uploadedUrls.length} image(s) téléversée(s) et compressée(s) avec succès`, "success");
      }
    } catch (globalErr: unknown) {
      console.error("Erreur globale uploadMultipleAndApply:", globalErr);
      const msg = globalErr instanceof Error ? globalErr.message : "Erreur inattendue";
      setError(`Erreur lors du traitement : ${msg}`);
      showToast(`Erreur : ${msg}`, "error");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 500);
    }
  }

  if (field.kind === "imageList") {
    const urls = Array.isArray(value) ? (value as string[]) : [];
    const min = field.minItems ?? 0;
    const max = field.maxItems ?? Infinity;
    const isBelowMin = min > 0 && urls.length < min;
    const isAtMax = urls.length >= max;
    const remainingSlots = Math.max(0, max - urls.length);

    async function removeImageAtIndex(index: number, imageUrl: string) {
      const next = urls.filter((_, j) => j !== index);
      onChange(next);
      showToast("Image supprimée du stockage", "success");
      try {
        const res = await deleteBlockImage(imageUrl);
        if (!res.ok) {
          console.warn("Échec suppression image Supabase:", res.error);
        }
      } catch (e) {
        console.error("Erreur suppression image Supabase:", e);
      }
    }

    async function replaceImageAtIndex(file: File, index: number, oldUrl: string) {
      setUploading(true);
      setReplacingIndex(index);
      setError(null);
      setUploadProgress({
        current: 1,
        total: 1,
        percent: 30,
        label: `Optimisation de la nouvelle image #${index + 1}…`,
      });

      try {
        const preparedFile = await prepareImageForUpload(file);

        setUploadProgress({
          current: 1,
          total: 1,
          percent: 70,
          label: `Téléversement et remplacement #${index + 1}…`,
        });

        const formData = new FormData();
        formData.append("file", preparedFile);
        formData.append("blockType", blockType);
        formData.append("fieldKey", field.key);
        const res = await uploadBlockImage(formData);

        if (!res.ok) {
          setError(res.error);
          showToast(`Erreur lors du remplacement : ${res.error}`, "error");
          return;
        }

        setUploadProgress({
          current: 1,
          total: 1,
          percent: 100,
          label: `Image #${index + 1} remplacée et compressée !`,
        });

        const next = [...urls];
        next[index] = res.url;
        onChange(next);

        // Supprime l'ancienne image du stockage Supabase
        if (oldUrl && oldUrl !== res.url) {
          deleteBlockImage(oldUrl).catch(console.error);
        }

        showToast("Image remplacée et compressée avec succès", "success");
      } catch (err: unknown) {
        console.error("Erreur replaceImageAtIndex:", err);
        const msg = err instanceof Error ? err.message : "Erreur de remplacement";
        setError(`Erreur lors du remplacement : ${msg}`);
        showToast(`Erreur : ${msg}`, "error");
      } finally {
        setUploading(false);
        setReplacingIndex(null);
        setTimeout(() => setUploadProgress(null), 500);
      }
    }

    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ font: `600 12px ${fonts.ui}`, color: colors.muted }}>
            {field.label}
          </label>
          {max < Infinity && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                background: isBelowMin ? "#FEF3C7" : isAtMax ? "#E5E7EB" : "#D1FAE5",
                color: isBelowMin ? "#92400E" : isAtMax ? "#374151" : "#065F46",
              }}
            >
              {urls.length} / {max} images
            </span>
          )}
        </div>

        {field.help && (
          <div style={{ fontSize: 11.5, color: colors.muted, marginBottom: 8, lineHeight: 1.3 }}>
            {field.help}
          </div>
        )}

        {/* Bannière de statut d'éligibilité pour la bande déroulante */}
        {min > 0 && (
          <div
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              fontSize: 11.5,
              lineHeight: 1.35,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: isBelowMin ? "#FFFBEB" : "#ECFDF5",
              border: `1px solid ${isBelowMin ? "#FDE68A" : "#A7F3D0"}`,
              color: isBelowMin ? "#92400E" : "#065F46",
            }}
          >
            <span style={{ fontSize: 13 }}>{isBelowMin ? "⚠️" : "✓"}</span>
            <span>
              {isBelowMin
                ? `Encore ${min - urls.length} image(s) requise(s) pour la bande déroulante (minimum ${min})`
                : `Bande déroulante prête (${urls.length} images configurées)`}
            </span>
          </div>
        )}

        {progressBar}

        {urls.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 8,
              marginBottom: 8,
            }}
          >
            {urls.map((src, i) => (
              <div
                key={src + i}
                style={{
                  position: "relative",
                  width: 114,
                  flexShrink: 0,
                  border: "1.5px solid rgba(30,27,24,0.1)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fdfbf9",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Conteneur image ratio 3:4 */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", background: "#f0ede8" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Miniature ${i + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      opacity: replacingIndex === i ? 0.4 : 1,
                    }}
                  />

                  {/* Badge numéro */}
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      background: "rgba(0, 0, 0, 0.7)",
                      backdropFilter: "blur(2px)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 4,
                      pointerEvents: "none",
                    }}
                  >
                    #{i + 1}
                  </span>

                  {/* Bouton rond '✕' flottant de suppression immédiate */}
                  <button
                    type="button"
                    onClick={() => removeImageAtIndex(i, src)}
                    disabled={uploading}
                    title="Supprimer cette image (retire et supprime du stockage)"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1.5px solid rgba(220, 38, 38, 0.35)",
                      color: "#DC2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: uploading ? "not-allowed" : "pointer",
                      fontSize: 11,
                      fontWeight: 800,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      lineHeight: 1,
                      padding: 0,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#DC2626";
                      e.currentTarget.style.color = "#FFFFFF";
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.95)";
                      e.currentTarget.style.color = "#DC2626";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Barre d'outils inférieure : réordonner et remplacer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    padding: "3px 2px",
                    background: "#ffffff",
                    borderTop: "1px solid rgba(30,27,24,0.08)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onChange(moveItem(urls, i, i - 1))}
                    disabled={i === 0 || uploading}
                    style={{
                      ...tinyBtnStyle,
                      padding: "2px 5px",
                      fontSize: 11,
                      opacity: i === 0 ? 0.35 : 1,
                      cursor: i === 0 ? "default" : "pointer",
                    }}
                    title="Déplacer vers la gauche"
                  >
                    ←
                  </button>

                  <label
                    style={{
                      ...tinyBtnStyle,
                      padding: "2px 5px",
                      fontSize: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: uploading ? "default" : "pointer",
                      opacity: uploading ? 0.6 : 1,
                      color: colors.primary,
                      fontWeight: 600,
                    }}
                    title="Remplacer cette image"
                  >
                    {replacingIndex === i ? "…" : "Remplacer"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) {
                          replaceImageAtIndex(file, i, src);
                        }
                      }}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => onChange(moveItem(urls, i, i + 1))}
                    disabled={i === urls.length - 1 || uploading}
                    style={{
                      ...tinyBtnStyle,
                      padding: "2px 5px",
                      fontSize: 11,
                      opacity: i === urls.length - 1 ? 0.35 : 1,
                      cursor: i === urls.length - 1 ? "default" : "pointer",
                    }}
                    title="Déplacer vers la droite"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label
          style={{
            ...miniBtnStyle,
            cursor: uploading || isAtMax ? "default" : "pointer",
            opacity: isAtMax ? 0.5 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
          }}
        >
          {uploading
            ? "Téléversement en cours…"
            : isAtMax
            ? `Limite atteinte (${max} images)`
            : urls.length === 0
            ? "Ajouter des images (5 min - 10 max)"
            : `+ Ajouter d'autres images (${remainingSlots} restante${remainingSlots > 1 ? "s" : ""})`}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploading || isAtMax}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (files.length > 0) {
                const allowedFiles = files.slice(0, remainingSlots);
                uploadMultipleAndApply(allowedFiles, (addedUrls) => {
                  onChange([...urls, ...addedUrls].slice(0, max));
                });
              }
            }}
            style={{ display: "none" }}
          />
        </label>
        {error && (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#B3261E",
              background: "#FDF2F2",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #FCA5A5",
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {field.kind !== "toggle" && label}
      {field.kind === "textarea" ? (
        <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...base, resize: "vertical" }} />
      ) : field.kind === "select" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base}>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.kind === "toggle" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, font: `600 12px ${fonts.ui}`, color: colors.muted }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      ) : field.kind === "number" ? (
        <NumericField mode="integer" value={String(value ?? 0)} onChange={(v) => onChange(Number(v) || 0)} />
      ) : (
        <input type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base} />
      )}
    </div>
  );
}
