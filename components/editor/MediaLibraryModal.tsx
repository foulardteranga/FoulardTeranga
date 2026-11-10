"use client";

import { useEffect, useMemo, useState } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { DEFAULT_BLOCK_NAMES } from "@/lib/storefront/blockIds";
import { listTenantImages, type TenantImage } from "@/lib/storefront/actions";

const FOLDER_LABELS: Record<string, string> = {
  products: "Produits",
  ...DEFAULT_BLOCK_NAMES,
};

function folderLabel(folder: string): string {
  return FOLDER_LABELS[folder] ?? folder;
}

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sélection multiple (champs imageList) ou simple (champs image). */
  multiple: boolean;
  onSelect: (urls: string[]) => void;
  /** Nombre maximum d'images sélectionnables en mode multiple. */
  remainingSlots?: number;
}

export function MediaLibraryModal({
  isOpen,
  onClose,
  multiple,
  onSelect,
  remainingSlots,
}: MediaLibraryModalProps) {
  const [images, setImages] = useState<TenantImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  function load() {
    setError(null);
    setLoading(true);
    listTenantImages()
      .then((res) => {
        if (res.ok) setImages(res.images);
        else setError(res.error);
      })
      .catch(() => setError("Impossible de charger la bibliothèque, réessayez."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, TenantImage[]>();
    for (const img of images) {
      const list = map.get(img.folder) ?? [];
      list.push(img);
      map.set(img.folder, list);
    }
    return Array.from(map.entries());
  }, [images]);

  if (!isOpen) return null;

  const max = multiple ? (remainingSlots ?? Infinity) : 1;

  function toggle(url: string) {
    if (!multiple) {
      onSelect([url]);
      onClose();
      return;
    }
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= max) return prev;
      return [...prev, url];
    });
  }

  function confirmSelection() {
    if (selected.length === 0) return;
    onSelect(selected);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-library-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(30, 27, 24, 0.52)",
        backdropFilter: "blur(2px)",
        animation: "ft-fade 0.15s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 20px 48px -6px rgba(30,27,24,0.24)",
          border: adminBorder,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "ft-fade 0.18s ease-out",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${colors.borderSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: colors.ivory,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="media-library-title"
              style={{ margin: 0, fontFamily: fonts.display, fontWeight: 600, fontSize: 17, color: colors.ink }}
            >
              Bibliothèque d'images
            </h3>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {multiple
                ? `Sélectionnez une ou plusieurs images déjà en ligne${max < Infinity ? ` (${max} max)` : ""}.`
                : "Choisissez une image déjà en ligne."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: "none",
              background: "#EBE5D8",
              width: 32,
              height: 32,
              borderRadius: 999,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.muted,
              flex: "none",
            }}
          >
            <Icon path={ICONS.close} size={15} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: colors.muted, fontSize: 13 }}>
              Chargement des images…
            </div>
          ) : error ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ color: colors.fgDanger, fontSize: 13, marginBottom: 10 }}>{error}</div>
              <button
                type="button"
                onClick={load}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: `1.5px solid ${colors.borderField}`,
                  background: "#fff",
                  color: colors.primary,
                  font: `600 12px ${fonts.ui}`,
                  cursor: "pointer",
                }}
              >
                Réessayer
              </button>
            </div>
          ) : images.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: colors.muted, fontSize: 13 }}>
              Aucune image pour le moment — téléversez-en une d'abord.
            </div>
          ) : (
            grouped.map(([folder, items]) => (
              <div key={folder} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: colors.muted,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    marginBottom: 8,
                  }}
                >
                  {folderLabel(folder)} ({items.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                  {items.map((img) => {
                    const isSelected = selected.includes(img.url);
                    const disabled = multiple && !isSelected && selected.length >= max;
                    return (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => toggle(img.url)}
                        disabled={disabled}
                        title={img.fileName}
                        aria-label={img.fileName}
                        aria-pressed={multiple ? isSelected : undefined}
                        className={disabled ? undefined : "ft-card-hover"}
                        style={{
                          position: "relative",
                          aspectRatio: "1 / 1",
                          borderRadius: 10,
                          overflow: "hidden",
                          border: isSelected ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.borderField}`,
                          padding: 0,
                          cursor: disabled ? "not-allowed" : "pointer",
                          opacity: disabled ? 0.4 : 1,
                          background: "#f0ede8",
                          transition: "border-color .15s, box-shadow .15s",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        {isSelected && (
                          <span
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: colors.primary,
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon path={ICONS.check} size={12} stroke="#fff" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {multiple && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: `1px solid ${colors.borderSoft}`,
              background: "#FAF7F2",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                border: `1.5px solid ${colors.borderField}`,
                background: "#fff",
                color: colors.ink,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmSelection}
              disabled={selected.length === 0}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: selected.length === 0 ? colors.disabled : colors.primary,
                color: "#fff",
                font: `600 13px ${fonts.ui}`,
                cursor: selected.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Utiliser la sélection ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
