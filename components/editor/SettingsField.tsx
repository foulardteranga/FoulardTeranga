"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import type { FieldDescriptor } from "@/lib/storefront/blockSettings";
import type { BlockId } from "@/lib/storefront/blockIds";
import { uploadBlockImage } from "@/lib/storefront/actions";

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadAndApply(file: File, apply: (url: string) => void) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("blockType", blockType);
    formData.append("fieldKey", field.key);
    const res = await uploadBlockImage(formData);
    setUploading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    apply(res.url);
  }

  const label = (
    <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
      {field.label}
    </label>
  );
  const base: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.borderField}`,
    borderRadius: 9, font: `400 13.5px ${fonts.ui}`, outline: "none",
  };

  if (field.kind === "image") {
    const url = typeof value === "string" ? value : "";
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
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
            {uploading ? "Envoi…" : url ? "Remplacer" : "Choisir une image"}
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
            <button type="button" onClick={() => onChange("")} disabled={uploading} style={miniBtnStyle}>
              Retirer
            </button>
          )}
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
      </div>
    );
  }

  if (field.kind === "imageList") {
    const urls = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div style={{ marginBottom: 14 }}>
        {label}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {urls.map((src, i) => (
            <div key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 9 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <button type="button" onClick={() => onChange(moveItem(urls, i, i - 1))} disabled={i === 0} style={tinyBtnStyle}>↑</button>
                <button type="button" onClick={() => onChange(moveItem(urls, i, i + 1))} disabled={i === urls.length - 1} style={tinyBtnStyle}>↓</button>
                <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))} style={tinyBtnStyle}>Retirer</button>
              </div>
            </div>
          ))}
        </div>
        <label style={{ ...miniBtnStyle, cursor: uploading ? "default" : "pointer" }}>
          {uploading ? "Envoi…" : "Ajouter une image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) uploadAndApply(f, (u) => onChange([...urls, u]));
            }}
            style={{ display: "none" }}
          />
        </label>
        {error && <div style={{ marginTop: 6, fontSize: 12, color: "#B3261E" }}>{error}</div>}
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
        <input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} style={base} />
      ) : (
        <input type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base} />
      )}
    </div>
  );
}
