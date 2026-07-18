"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { uploadProductImage } from "@/lib/inventory/actions";

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
}: {
  /** URL de la photo principale ; "" = aucune. */
  image: string;
  gallery: string[];
  onChange: (next: { image: string; gallery: string[] }) => void;
}) {
  const [uploading, setUploading] = useState<"image" | "gallery" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, target: "image" | "gallery") {
    setUploading(target);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadProductImage(formData);
    setUploading(null);
    if (!res.ok) { setError(res.error); return; }
    if (target === "image") onChange({ image: res.url, gallery });
    else onChange({ image, gallery: [...gallery, res.url] });
  }

  function filePicker(target: "image" | "gallery", label: string) {
    return (
      <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
        {uploading === target ? "Envoi…" : label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading !== null}
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
          <button type="button" onClick={() => onChange({ image: "", gallery })} disabled={uploading !== null} style={miniBtnStyle}>
            Retirer
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
                <button type="button" onClick={() => onChange({ image, gallery: moveItem(gallery, i, i - 1) })} disabled={i === 0} style={tinyBtnStyle}>↑</button>
                <button type="button" onClick={() => onChange({ image, gallery: moveItem(gallery, i, i + 1) })} disabled={i === gallery.length - 1} style={tinyBtnStyle}>↓</button>
                <button type="button" onClick={() => onChange({ image, gallery: gallery.filter((_, j) => j !== i) })} style={tinyBtnStyle}>Retirer</button>
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
