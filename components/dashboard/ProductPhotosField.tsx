"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { prepareImageForUpload, uploadProductImageClient } from "@/lib/images/client";

const miniBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 34, padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`, borderRadius: 8, background: "#fff",
  color: colors.primary, font: `600 12px ${fonts.ui}`,
};

const tinyBtnStyle: React.CSSProperties = {
  height: 26, padding: "0 8px", border: `1.5px solid ${colors.borderField}`, borderRadius: 6,
  background: "#fff", color: colors.primary, font: `600 11px ${fonts.ui}`, cursor: "pointer",
};

function moveItem(arr: string[], from: number, to: number): string[] {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function ProductPhotosField({
  image,
  gallery,
  onChange,
  onRemoveImage,
}: {
  /** URL de la photo principale ; "" = aucune. */
  image: string;
  gallery: string[];
  onChange: (next: { image: string; gallery: string[] }) => void;
  /** Callback optionnel pour supprimer l'image du serveur et du stockage au clic sur Retirer. */
  onRemoveImage?: (url: string) => Promise<void> | void;
}) {
  const [uploading, setUploading] = useState<"image" | "gallery" | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, target: "image" | "gallery") {
    setUploading(target);
    setError(null);
    try {
      const preparedFile = await prepareImageForUpload(file);
      const formData = new FormData();
      formData.append("file", preparedFile);
      const res = await uploadProductImageClient(formData);
      if (!res.ok) { setError(res.error); return; }
      if (target === "image") onChange({ image: res.url, gallery });
      else onChange({ image, gallery: [...gallery, res.url] });
    } catch {
      setError("Une erreur est survenue lors de l'envoi de la photo.");
    } finally {
      setUploading(null);
    }
  }

  async function handleRemoveMain() {
    const oldUrl = image;
    onChange({ image: "", gallery });
    if (onRemoveImage && oldUrl) {
      setDeletingUrl(oldUrl);
      try {
        await onRemoveImage(oldUrl);
      } finally {
        setDeletingUrl(null);
      }
    }
  }

  async function handleRemoveGallery(index: number, url: string) {
    onChange({ image, gallery: gallery.filter((_, j) => j !== index) });
    if (onRemoveImage && url) {
      setDeletingUrl(url);
      try {
        await onRemoveImage(url);
      } finally {
        setDeletingUrl(null);
      }
    }
  }

  function filePicker(target: "image" | "gallery", label: string) {
    const isBusy = uploading !== null || deletingUrl !== null;
    return (
      <label style={{ ...miniBtnStyle, cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.6 : 1 }}>
        {uploading === target ? "Envoi…" : label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isBusy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f, target);
          }}
          style={{ display: "none" }}
        />
      </label>
    );
  }

  return (
    <div>
      <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
        Photo principale
      </label>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Photo principale du produit" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 9, marginBottom: 8 }} />
      ) : (
        <div style={{ width: "100%", height: 90, border: `1.5px dashed ${colors.borderField}`, borderRadius: 9, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: colors.muted }}>
          Aucune photo
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {filePicker("image", image ? "Remplacer" : "Choisir une photo")}
        {image && (
          <button
            type="button"
            onClick={handleRemoveMain}
            disabled={uploading !== null || deletingUrl !== null}
            style={{ ...miniBtnStyle, cursor: deletingUrl ? "default" : "pointer" }}
          >
            {deletingUrl === image ? "Suppression…" : "Retirer"}
          </button>
        )}
      </div>

      <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
        Galerie (fiche produit)
      </label>
      {gallery.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {gallery.map((src, i) => (
            <div key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1} de la galerie`} style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 9 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <button type="button" onClick={() => onChange({ image, gallery: moveItem(gallery, i, i - 1) })} disabled={i === 0 || deletingUrl !== null} style={tinyBtnStyle}>↑</button>
                <button type="button" onClick={() => onChange({ image, gallery: moveItem(gallery, i, i + 1) })} disabled={i === gallery.length - 1 || deletingUrl !== null} style={tinyBtnStyle}>↓</button>
                <button
                  type="button"
                  onClick={() => handleRemoveGallery(i, src)}
                  disabled={deletingUrl !== null}
                  style={tinyBtnStyle}
                >
                  {deletingUrl === src ? "…" : "Retirer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {filePicker("gallery", "Ajouter une photo")}
      {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
    </div>
  );
}
