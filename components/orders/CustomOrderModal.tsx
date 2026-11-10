"use client";

import { useEffect, useMemo, useState } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { NumericField } from "@/components/ui/NumericField";
import { searchColors } from "@/lib/colors/catalog";
import { generateShades } from "@/lib/colors/shades";
import { getTenantColors, type TenantColorItem } from "@/lib/colors/actions";
import { CustomColorModal } from "@/components/dashboard/CustomColorModal";
import { POPULAR_SWATCHES } from "@/components/dashboard/ProductVariantsField";
import { prepareImageForUpload, uploadProductImageClient } from "@/lib/images/client";
import { createCustomOrder } from "@/lib/orders/actions";
import { useBackoffice } from "@/lib/store/useBackoffice";

export function CustomOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [clientName, setClientName] = useState("");
  const [place, setPlace] = useState("");
  const [phone, setPhone] = useState("");
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [colorSearch, setColorSearch] = useState("");
  const [colorSearchOpen, setColorSearchOpen] = useState(false);
  const [customColorModalOpen, setCustomColorModalOpen] = useState(false);
  const [tenantFavorites, setTenantFavorites] = useState<TenantColorItem[]>([]);
  const [fabricNote, setFabricNote] = useState("");
  const [model, setModel] = useState("");
  const [modelImageUrl, setModelImageUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useBackoffice((s) => s.showToast);

  useEffect(() => {
    let cancelled = false;
    getTenantColors().then((items) => {
      if (!cancelled) setTenantFavorites(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchResults = useMemo(() => {
    if (!colorSearch.trim()) return [];
    return searchColors(colorSearch.trim()).slice(0, 6);
  }, [colorSearch]);

  function selectColor(name: string, hex: string) {
    setColorName(name);
    setColorHex(hex);
    setColorSearch("");
    setColorSearchOpen(false);
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    setError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      const formData = new FormData();
      formData.append("file", prepared);
      const res = await uploadProductImageClient(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setModelImageUrl(res.url);
    } catch {
      setError("Une erreur est survenue lors de l'envoi de la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const valid =
    clientName.trim().length >= 2 &&
    place.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    Number(total) >= 100;

  async function submit() {
    setSaving(true);
    setError(null);
    const result = await createCustomOrder({
      clientName,
      place,
      phone,
      colorName: colorName || undefined,
      colorHex: colorHex || undefined,
      fabricNote: fabricNote || undefined,
      model: model || undefined,
      modelImageUrl: modelImageUrl || undefined,
      dueDate: dueDate || undefined,
      total: Number(total),
      deposit: deposit ? Number(deposit) : undefined,
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(`Commande personnalisée ${result.ref} créée`, "success");
    onCreated();
  }

  const favoriteSwatches = [
    ...tenantFavorites.map((f) => ({ id: f.id, name: f.name, hex: f.hex })),
    ...POPULAR_SWATCHES.map((s, i) => ({ id: `pop-${i}`, name: s.name, hex: s.hex })),
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 16, width: 480, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", padding: "22px 24px", boxShadow: "0 20px 50px rgba(30,27,24,.24)" }}
        >
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
            Commande personnalisée
          </div>
          <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 18 }}>
            Confection sur mesure — sans produit catalogue, prix saisi à la main.
          </div>

          <label style={fieldLabel}>Nom de la cliente</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={fieldInput} placeholder="Awa Diop" />

          <label style={fieldLabel}>Téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldInput} placeholder="07 00 00 00 00" />

          <label style={fieldLabel}>Lieu de livraison</label>
          <input value={place} onChange={(e) => setPlace(e.target.value)} style={fieldInput} placeholder="Cocody, Abidjan" />

          <label style={fieldLabel}>Couleur du tissu</label>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", height: 42, padding: "0 12px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", gap: 8 }}>
              <Icon path={ICONS.search} size={15} stroke={colors.muted} />
              <input
                type="text"
                value={colorSearch}
                onChange={(e) => {
                  setColorSearch(e.target.value);
                  setColorSearchOpen(true);
                }}
                onFocus={() => setColorSearchOpen(true)}
                placeholder="Rechercher une teinte…"
                style={{ flex: 1, border: "none", outline: "none", font: `400 13.5px ${fonts.ui}`, background: "transparent" }}
              />
            </div>
            {colorSearchOpen && searchResults.length > 0 && (
              <div
                style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: "#fff", borderRadius: 12, boxShadow: "0 12px 32px -4px rgba(30,27,24,0.18)", border: adminBorder, zIndex: 30, maxHeight: 220, overflowY: "auto", padding: "6px 0" }}
              >
                {searchResults.map((item) => {
                  const shades = generateShades(item.hex, item.name);
                  return (
                    <div key={item.name} style={{ padding: "8px 14px", borderTop: `1px solid ${colors.faintLine}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {shades.map((shade) => (
                          <button
                            key={shade.hex}
                            type="button"
                            onClick={() => selectColor(shade.name, shade.hex)}
                            title={shade.name}
                            style={{ width: 28, height: 28, borderRadius: 7, background: shade.hex, border: `2px solid ${colorHex.toLowerCase() === shade.hex.toLowerCase() ? colors.primary : "rgba(0,0,0,0.14)"}`, cursor: "pointer" }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {favoriteSwatches.map((swatch) => {
              const isSelected = colorHex.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => selectColor(swatch.name, swatch.hex)}
                  title={swatch.name}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", height: 34, borderRadius: 9, border: `1.5px solid ${isSelected ? colors.primary : colors.borderField}`, background: isSelected ? colors.bgInfo : "#fff", cursor: "pointer", fontSize: 12, fontWeight: isSelected ? 600 : 500, color: isSelected ? colors.primary : colors.ink }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: swatch.hex, border: "1px solid rgba(0,0,0,0.15)" }} />
                  {swatch.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomColorModalOpen(true)}
              style={{ border: "none", background: "transparent", color: colors.primary, font: `600 12px ${fonts.ui}`, cursor: "pointer", padding: "6px 8px" }}
            >
              + Couleur sur mesure
            </button>
          </div>
          {colorName && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: colors.muted }}>
              <span style={{ width: 16, height: 16, borderRadius: 5, background: colorHex, border: "1px solid rgba(0,0,0,0.15)" }} />
              {colorName}
              <button
                type="button"
                onClick={() => {
                  setColorName("");
                  setColorHex("");
                }}
                style={{ border: "none", background: "transparent", color: colors.danger, cursor: "pointer", fontSize: 12 }}
              >
                Retirer
              </button>
            </div>
          )}

          <label style={fieldLabel}>Motif / matière</label>
          <input value={fabricNote} onChange={(e) => setFabricNote(e.target.value)} style={fieldInput} placeholder="Bazin brodé, motif wax…" />

          <label style={fieldLabel}>Modèle à confectionner</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} style={fieldInput} placeholder="Robe wax ajustée, manches longues…" />

          <label style={fieldLabel}>Photo du modèle (optionnel)</label>
          {modelImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={modelImageUrl} alt="Photo du modèle" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 9, marginBottom: 8 }} />
          )}
          <label style={{ ...miniBtnStyle, cursor: uploadingPhoto ? "default" : "pointer", opacity: uploadingPhoto ? 0.6 : 1, marginBottom: 14 }}>
            {uploadingPhoto ? "Envoi…" : modelImageUrl ? "Remplacer la photo" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handlePhotoUpload(f);
              }}
              style={{ display: "none" }}
            />
          </label>

          <label style={fieldLabel}>Date de livraison souhaitée</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={fieldInput} />

          <label style={fieldLabel}>Prix convenu (FCFA)</label>
          <NumericField mode="money" value={total} onChange={setTotal} placeholder="0" />

          <div style={{ marginTop: 12 }}>
            <label style={fieldLabel}>Acompte versé (FCFA, optionnel)</label>
            <NumericField mode="money" value={deposit} onChange={setDeposit} placeholder="0" />
          </div>

          {error && <div style={{ marginTop: 10, fontSize: 12.5, color: colors.danger }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer" }}
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={saving || !valid}
              style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: saving || !valid ? "default" : "pointer", opacity: saving || !valid ? 0.7 : 1 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      <CustomColorModal
        isOpen={customColorModalOpen}
        onClose={() => setCustomColorModalOpen(false)}
        onSelect={({ name, hex }) => selectColor(name, hex)}
      />
    </>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  font: `600 12px ${fonts.ui}`,
  color: colors.muted,
  marginTop: 12,
  marginBottom: 6,
};
const fieldInput: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 13px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14px ${fonts.ui}`,
};
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
