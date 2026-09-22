"use client";

import { useState } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { generateShades } from "@/lib/colors/shades";
import { saveCustomColor } from "@/lib/colors/actions";

interface CustomColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (color: { name: string; hex: string }) => void;
}

export function CustomColorModal({ isOpen, onClose, onSelect }: CustomColorModalProps) {
  const [hex, setHex] = useState("#A35C6A");
  const [name, setName] = useState("");
  const [isFavorite, setIsFavorite] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validHex = /^#[0-9a-fA-F]{6}$/.test(hex);
  const previewShades = validHex ? generateShades(hex, name || "Teinte personnalisée") : [];

  async function handleConfirm() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Veuillez indiquer un nom commercial pour cette couleur.");
      return;
    }
    if (!validHex) {
      setError("Le code couleur HEX doit respecter le format #RRGGBB (ex: #6B1D2F).");
      return;
    }

    setSaving(true);
    setError(null);

    if (isFavorite) {
      try {
        await saveCustomColor({
          name: trimmedName,
          hex,
          isFavorite: true,
        });
      } catch {
        // En cas d'échec de sauvegarde favori, on continue pour ne pas bloquer l'ajout au produit
      }
    }

    setSaving(false);
    onSelect({ name: trimmedName, hex });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-color-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(30, 27, 24, 0.48)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 48px -8px rgba(30,27,24,0.22)",
          border: adminBorder,
          overflow: "hidden",
          animation: "ft-fade 0.18s ease-out",
        }}
      >
        {/* En-tête */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${colors.borderSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: colors.ivory,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: validHex ? hex : colors.sable,
                border: "1px solid rgba(0,0,0,0.12)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
              }}
            />
            <h3
              id="custom-color-title"
              style={{
                margin: 0,
                fontFamily: fonts.display,
                fontWeight: 600,
                fontSize: 16,
                color: colors.ink,
              }}
            >
              Nouvelle teinte sur mesure
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: "none",
              background: "transparent",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: colors.muted,
            }}
          >
            <Icon path={ICONS.close} size={16} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: "20px 20px 16px" }}>
          {/* Nom commercial */}
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="custom-color-name"
              style={{
                display: "block",
                font: `600 12px ${fonts.ui}`,
                color: colors.muted,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              Nom de la teinte *
            </label>
            <input
              id="custom-color-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex : Poudre de rose, Vert d'eau, Terracotta doré..."
              style={{
                width: "100%",
                height: 42,
                padding: "0 13px",
                border: `1.5px solid ${colors.borderField}`,
                borderRadius: 10,
                font: `400 14px ${fonts.ui}`,
                outline: "none",
                boxSizing: "border-box",
              }}
              autoFocus
            />
          </div>

          {/* Sélecteur de couleur HEX & Picker */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                font: `600 12px ${fonts.ui}`,
                color: colors.muted,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              Couleur & Code HEX
            </label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  position: "relative",
                  width: 44,
                  height: 42,
                  borderRadius: 10,
                  overflow: "hidden",
                  border: `1.5px solid ${colors.borderField}`,
                  flex: "none",
                  cursor: "pointer",
                }}
              >
                <input
                  type="color"
                  value={validHex ? hex : "#000000"}
                  onChange={(e) => {
                    setHex(e.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  style={{
                    position: "absolute",
                    inset: -8,
                    width: 60,
                    height: 60,
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                  }}
                  aria-label="Palette visuelle de couleur"
                />
              </div>
              <input
                type="text"
                value={hex}
                onChange={(e) => {
                  let v = e.target.value.trim();
                  if (!v.startsWith("#") && v.length > 0) v = "#" + v;
                  setHex(v.toUpperCase());
                  if (error) setError(null);
                }}
                maxLength={7}
                placeholder="#6B1D2F"
                style={{
                  flex: 1,
                  height: 42,
                  padding: "0 13px",
                  border: `1.5px solid ${validHex ? colors.borderField : colors.danger}`,
                  borderRadius: 10,
                  font: `500 14px monospace`,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Nuances HSL automatiques */}
          {validHex && previewShades.length > 0 && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 14px",
                background: colors.ivory,
                borderRadius: 12,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <div
                style={{
                  font: `600 11.5px ${fonts.ui}`,
                  color: colors.muted,
                  marginBottom: 8,
                }}
              >
                Nuances HSL calculées automatiquement :
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {previewShades.map((s) => (
                  <div
                    key={s.hex}
                    title={`${s.name} (${s.hex})`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: s.hex,
                        border: "1px solid rgba(0,0,0,0.14)",
                        boxShadow: s.role === "ref" ? `0 0 0 2px ${colors.ink}` : "none",
                      }}
                    />
                    <span style={{ fontSize: 10, color: colors.muted }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Option Favori */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              font: `500 13px ${fonts.ui}`,
              color: colors.ink,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: colors.primary, cursor: "pointer" }}
            />
            <span>Mémoriser dans les teintes favorites de la boutique</span>
          </label>

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: "8px 12px",
                background: colors.bgDanger,
                color: colors.fgDanger,
                borderRadius: 8,
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${colors.borderSoft}`,
            display: "flex",
            gap: 10,
            background: "#FAF7F2",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              height: 42,
              border: `1.5px solid ${colors.borderField}`,
              borderRadius: 10,
              background: "#fff",
              color: colors.ink,
              font: `600 13px ${fonts.ui}`,
              cursor: saving ? "default" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !validHex || !name.trim()}
            className="ft-primary-btn"
            style={{
              flex: 1.5,
              height: 42,
              border: "none",
              borderRadius: 10,
              background: colors.primary,
              color: "#fff",
              font: `600 13px ${fonts.ui}`,
              cursor: saving || !validHex || !name.trim() ? "default" : "pointer",
              opacity: saving || !validHex || !name.trim() ? 0.6 : 1,
            }}
          >
            {saving ? "Enregistrement…" : "Utiliser cette couleur"}
          </button>
        </div>
      </div>
    </div>
  );
}
