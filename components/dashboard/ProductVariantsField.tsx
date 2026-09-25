"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { NumericPad } from "@/components/ui/NumericPad";
import { searchColors, COLOR_CATALOG } from "@/lib/colors/catalog";
import { generateShades } from "@/lib/colors/shades";
import { getTenantColors, type TenantColorItem } from "@/lib/colors/actions";
import { CustomColorModal } from "./CustomColorModal";
import type { ProductVariantInput } from "@/lib/validators/product";

export interface ProductVariantItem extends ProductVariantInput {
  id?: string;
}

interface ProductVariantsFieldProps {
  variants: ProductVariantItem[];
  onChange: (variants: ProductVariantItem[]) => void;
  baseSwatch?: string;
}

// 8 teintes incontournables toujours accessibles d'un clic
const POPULAR_SWATCHES = [
  { name: "Noir ébène", hex: "#1C1B1F" },
  { name: "Blanc cassé", hex: "#F8F5F0" },
  { name: "Bordeaux", hex: "#6B1D2F" },
  { name: "Terracotta", hex: "#C85A32" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Bleu nuit", hex: "#0D1B2A" },
  { name: "Vert émeraude", hex: "#0F52BA" },
  { name: "Ocre", hex: "#C99700" },
];

function getContrastingColor(hex: string): string {
  const cleanHex = hex.replace("#", "");
  const fullHex = cleanHex.length === 3
    ? cleanHex.split("").map((c) => c + c).join("")
    : cleanHex;
  const r = parseInt(fullHex.substring(0, 2), 16) || 0;
  const g = parseInt(fullHex.substring(2, 4), 16) || 0;
  const b = parseInt(fullHex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 155 ? "#1C1B1F" : "#FFFFFF";
}

export function ProductVariantsField({ variants, onChange, baseSwatch }: ProductVariantsFieldProps) {
  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [tenantFavorites, setTenantFavorites] = useState<TenantColorItem[]>([]);
  const [activeVariantPadIndex, setActiveVariantPadIndex] = useState<number | null>(null);
  const [variantPadDraft, setVariantPadDraft] = useState("0");
  const searchContainerRef = useRef<HTMLDivElement>(null);

  function openVariantPad(index: number) {
    setActiveVariantPadIndex(index);
    setVariantPadDraft(String(variants[index]?.stock ?? 0));
  }

  function confirmVariantPad() {
    if (activeVariantPadIndex !== null) {
      const num = Math.max(0, parseInt(variantPadDraft, 10) || 0);
      updateVariant(activeVariantPadIndex, { stock: num });
      setActiveVariantPadIndex(null);
    }
  }

  // Charger les favoris enregistrés de la boutique
  useEffect(() => {
    let cancelled = false;
    getTenantColors().then((items) => {
      if (!cancelled) setTenantFavorites(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fermer la recherche lors d'un clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return searchColors(search.trim()).slice(0, 6);
  }, [search]);

  function addVariant(colorName: string, colorHex: string) {
    // Si la couleur existe déjà dans les variantes, on ne duplique pas
    if (variants.some((v) => v.colorHex.toLowerCase() === colorHex.toLowerCase())) {
      return;
    }
    const newVariant: ProductVariantItem = {
      colorName,
      colorHex,
      stock: 0,
      active: true,
      position: variants.length,
    };
    onChange([...variants, newVariant]);
    setSearch("");
    setIsSearchOpen(false);
  }

  function toggleVariant(colorName: string, colorHex: string) {
    const existingIndex = variants.findIndex(
      (v) => v.colorHex.toLowerCase() === colorHex.toLowerCase()
    );
    if (existingIndex >= 0) {
      removeVariant(existingIndex);
    } else {
      addVariant(colorName, colorHex);
    }
  }

  function updateVariant(index: number, patch: Partial<ProductVariantItem>) {
    const next = [...variants];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeVariant(index: number) {
    const next = variants.filter((_, i) => i !== index);
    onChange(next);
  }

  const totalStock = variants.filter((v) => v.active).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Barre de recherche avec autocomplétion et nuances HSL directes */}
      <div ref={searchContainerRef} style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 42,
            padding: "0 12px",
            border: `1.5px solid ${colors.borderField}`,
            borderRadius: 10,
            background: "#fff",
            gap: 8,
          }}
        >
          <Icon path={ICONS.search} size={16} stroke={colors.muted} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Rechercher une teinte (ex: Bordeaux, Camel, Indigo...)"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              font: `400 13.5px ${fonts.ui}`,
              background: "transparent",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setIsSearchOpen(false);
              }}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 4,
                color: colors.muted,
              }}
            >
              <Icon path={ICONS.close} size={14} />
            </button>
          )}
        </div>

        {/* Menu déroulant des teintes trouvées avec 5 nuances HSL pour chaque couleur */}
        {isSearchOpen && searchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 6,
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 12px 32px -4px rgba(30,27,24,0.18)",
              border: adminBorder,
              zIndex: 30,
              maxHeight: 280,
              overflowY: "auto",
              padding: "6px 0",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 600,
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              Nuancier textile ({searchResults.length} résultats)
            </div>
            {searchResults.map((item) => {
              const shades = generateShades(item.hex, item.name);
              return (
                <div
                  key={item.name}
                  style={{
                    padding: "8px 14px",
                    borderTop: `1px solid ${colors.faintLine}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: colors.ink }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: colors.muted }}>
                      Famille : {item.family}
                    </div>
                  </div>

                  {/* 5 nuances cliquables avec sélection / désélection au tap */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {shades.map((shade) => {
                      const isAdded = variants.some(
                        (v) => v.colorHex.toLowerCase() === shade.hex.toLowerCase()
                      );
                      const contrast = getContrastingColor(shade.hex);
                      return (
                        <button
                          key={shade.hex}
                          type="button"
                          onClick={() => toggleVariant(shade.name, shade.hex)}
                          title={`${shade.name} (${shade.label}) — ${isAdded ? "Cliquer pour retirer" : "Cliquer pour ajouter"}`}
                          aria-pressed={isAdded}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: shade.hex,
                            border: `2px solid ${isAdded ? colors.primary : (shade.role === "ref" ? colors.ink : "rgba(0,0,0,0.14)")}`,
                            boxShadow: isAdded ? `0 0 0 2px #fff, 0 0 0 4px ${colors.primary}` : "none",
                            cursor: "pointer",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all .15s ease",
                          }}
                        >
                          {isAdded && <Icon path={ICONS.check} size={13} stroke={contrast} strokeWidth={2.4} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raccourcis rapides & Favoris de la boutique */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted }}>
            Teintes rapides & favorites
          </span>
          <button
            type="button"
            onClick={() => setCustomModalOpen(true)}
            style={{
              border: "none",
              background: "transparent",
              color: colors.primary,
              font: `600 12px ${fonts.ui}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            <Icon path={ICONS.plus} size={14} stroke="currentColor" />
            Couleur sur mesure
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Favoris enregistrés avec sélection/désélection directe */}
          {tenantFavorites.map((fav) => {
            const isAdded = variants.some(
              (v) => v.colorHex.toLowerCase() === fav.hex.toLowerCase()
            );
            const contrast = getContrastingColor(fav.hex);
            return (
              <button
                key={fav.id}
                type="button"
                onClick={() => toggleVariant(fav.name, fav.hex)}
                title={`${fav.name} — ${isAdded ? "Cliquer pour retirer" : "Cliquer pour ajouter"}`}
                aria-pressed={isAdded}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 11px",
                  minHeight: 38,
                  borderRadius: 10,
                  border: `1.5px solid ${isAdded ? colors.primary : colors.borderField}`,
                  background: isAdded ? colors.bgInfo : "#fff",
                  boxShadow: isAdded ? `0 0 0 1px ${colors.primary}` : "none",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: isAdded ? 600 : 500,
                  fontFamily: fonts.ui,
                  color: isAdded ? colors.primary : colors.ink,
                  transition: "all .15s ease",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    background: fav.hex,
                    border: "1px solid rgba(0,0,0,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isAdded && <Icon path={ICONS.check} size={10} stroke={contrast} strokeWidth={2.5} />}
                </span>
                <span>{fav.name}</span>
                <span style={{ fontSize: 10, color: colors.gold }}>⭐</span>
              </button>
            );
          })}

          {/* Palette populaire — boutons 38px confortables pour tactile & toggle direct */}
          {POPULAR_SWATCHES.map((swatch) => {
            const isAdded = variants.some(
              (v) => v.colorHex.toLowerCase() === swatch.hex.toLowerCase()
            );
            const contrast = getContrastingColor(swatch.hex);
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => toggleVariant(swatch.name, swatch.hex)}
                title={`${swatch.name} — ${isAdded ? "Cliquer pour retirer" : "Cliquer pour ajouter"}`}
                aria-pressed={isAdded}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: swatch.hex,
                  border: `2px solid ${isAdded ? colors.primary : "rgba(0,0,0,0.14)"}`,
                  boxShadow: isAdded ? `0 0 0 2px #fff, 0 0 0 4.5px ${colors.primary}` : "0 1px 3px rgba(0,0,0,0.06)",
                  cursor: "pointer",
                  transform: isAdded ? "scale(1.06)" : "scale(1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all .15s cubic-bezier(0.4, 0, 0.2, 1)",
                  outline: "none",
                }}
              >
                {isAdded && <Icon path={ICONS.check} size={15} stroke={contrast} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste des variantes actives du produit */}
      <div style={{ marginTop: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>
            Variantes associées ({variants.length})
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 6,
              background: colors.ivory,
              color: colors.primary,
            }}
          >
            Total stock : {totalStock} {totalStock <= 1 ? "unité" : "unités"}
          </span>
        </div>

        {variants.length === 0 ? (
          <div
            style={{
              padding: "16px 14px",
              background: colors.ivory,
              borderRadius: 10,
              border: `1px dashed ${colors.borderField}`,
              textAlign: "center",
              fontSize: 13,
              color: colors.muted,
            }}
          >
            Aucune variante de couleur définie. Sélectionnez une teinte ci-dessus ou cliquez sur &quot;Couleur sur mesure&quot;.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {variants.map((variant, index) => (
              <div
                key={variant.id || `${variant.colorHex}-${index}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  padding: "11px 13px",
                  borderRadius: 12,
                  border: `1.5px solid ${variant.active ? colors.borderField : colors.borderSoft}`,
                  background: variant.active ? "#fff" : colors.rowAlt,
                  opacity: variant.active ? 1 : 0.72,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  transition: "all .15s ease",
                }}
              >
                {/* Ligne 1 : Pastille de couleur, Nom éditable & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: variant.colorHex,
                      border: "1px solid rgba(0,0,0,0.18)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      flex: "none",
                    }}
                    title={variant.colorHex}
                  />

                  {/* Nom de la variante */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={variant.colorName}
                      onChange={(e) => updateVariant(index, { colorName: e.target.value })}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        font: `600 13.5px ${fonts.ui}`,
                        color: colors.ink,
                        background: "transparent",
                      }}
                      placeholder="Nom de la couleur"
                    />
                    <div style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>
                      {variant.colorHex}
                    </div>
                  </div>

                  {/* Interrupteur Actif */}
                  <button
                    type="button"
                    onClick={() => updateVariant(index, { active: !variant.active })}
                    title={variant.active ? "Variante active (cliquer pour masquer)" : "Variante inactive (cliquer pour activer)"}
                    style={{
                      border: "none",
                      background: variant.active ? colors.bgSuccess : colors.bgDanger,
                      color: variant.active ? colors.fgSuccess : colors.fgDanger,
                      borderRadius: 7,
                      padding: "6px 10px",
                      minHeight: 34,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      flex: "none",
                    }}
                  >
                    {variant.active ? "Actif" : "Masqué"}
                  </button>

                  {/* Supprimer avec zone tactile confortable */}
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    title="Supprimer cette variante"
                    aria-label={`Supprimer ${variant.colorName}`}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      width: 34,
                      height: 34,
                      color: colors.muted,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <Icon path={ICONS.trash} size={16} />
                  </button>
                </div>

                {/* Ligne 2 : Stepper tactile ergonomique pour tablette/mobile */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    background: colors.ivory,
                    borderRadius: 8,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: colors.primary }}>
                    <Icon path={ICONS.inv} size={14} stroke={colors.primary} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Stock disponible</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      aria-label="Diminuer le stock"
                      onClick={() => updateVariant(index, { stock: Math.max(0, (variant.stock || 0) - 1) })}
                      disabled={(variant.stock || 0) <= 0}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: `1.5px solid ${colors.borderField}`,
                        background: "#fff",
                        color: colors.primary,
                        font: `700 18px ${fonts.ui}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: (variant.stock || 0) <= 0 ? "not-allowed" : "pointer",
                        opacity: (variant.stock || 0) <= 0 ? 0.35 : 1,
                        userSelect: "none",
                      }}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => openVariantPad(index)}
                      title={`Cliquer pour saisir le stock de ${variant.colorName} au pavé numérique`}
                      style={{
                        minWidth: 50,
                        height: 36,
                        padding: "0 8px",
                        textAlign: "center",
                        font: `700 15px ${fonts.ui}`,
                        color: colors.primary,
                        background: "#fff",
                        border: `1.5px solid ${colors.borderField}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        userSelect: "none",
                        outline: "none",
                        transition: "all .12s ease",
                      }}
                    >
                      <span>{variant.stock}</span>
                      <Icon path={ICONS.keypad} size={13} stroke={colors.primary} />
                    </button>
                    <button
                      type="button"
                      aria-label="Augmenter le stock"
                      onClick={() => updateVariant(index, { stock: (variant.stock || 0) + 1 })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: `1.5px solid ${colors.borderField}`,
                        background: "#fff",
                        color: colors.primary,
                        font: `700 18px ${fonts.ui}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      +
                    </button>
                    <span style={{ fontSize: 12, color: colors.muted, fontWeight: 500, minWidth: 42 }}>
                      {variant.stock <= 1 ? "unité" : "unités"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal couleur sur mesure */}
      <CustomColorModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        onSelect={({ name, hex }) => addVariant(name, hex)}
      />

      {/* Modal digital pad pour saisir le stock de la variante */}
      <BottomSheet
        open={activeVariantPadIndex !== null}
        onClose={() => setActiveVariantPadIndex(null)}
        title={activeVariantPadIndex !== null ? `Stock — ${variants[activeVariantPadIndex]?.colorName || "Variante"}` : "Stock"}
      >
        <NumericPad
          value={variantPadDraft}
          mode="integer"
          onChange={setVariantPadDraft}
          onConfirm={confirmVariantPad}
        />
      </BottomSheet>
    </div>
  );
}
