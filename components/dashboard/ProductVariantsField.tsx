"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { NumericField } from "@/components/ui/NumericField";
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

export function ProductVariantsField({ variants, onChange, baseSwatch }: ProductVariantsFieldProps) {
  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [tenantFavorites, setTenantFavorites] = useState<TenantColorItem[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
      stock: 5,
      active: true,
      position: variants.length,
    };
    onChange([...variants, newVariant]);
    setSearch("");
    setIsSearchOpen(false);
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

                  {/* 5 nuances cliquables */}
                  <div style={{ display: "flex", gap: 5 }}>
                    {shades.map((shade) => {
                      const alreadyAdded = variants.some(
                        (v) => v.colorHex.toLowerCase() === shade.hex.toLowerCase()
                      );
                      return (
                        <button
                          key={shade.hex}
                          type="button"
                          onClick={() => addVariant(shade.name, shade.hex)}
                          title={`${shade.name} (${shade.label}) - Cliquer pour ajouter`}
                          disabled={alreadyAdded}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            background: shade.hex,
                            border: `1.5px solid ${shade.role === "ref" ? colors.ink : "rgba(0,0,0,0.14)"}`,
                            cursor: alreadyAdded ? "not-allowed" : "pointer",
                            opacity: alreadyAdded ? 0.35 : 1,
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {alreadyAdded && <Icon path={ICONS.check} size={12} stroke="#fff" />}
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
              padding: "2px 6px",
            }}
          >
            <Icon path={ICONS.plus} size={14} stroke="currentColor" />
            Couleur sur mesure
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Favoris enregistrés */}
          {tenantFavorites.map((fav) => {
            const isAdded = variants.some(
              (v) => v.colorHex.toLowerCase() === fav.hex.toLowerCase()
            );
            return (
              <button
                key={fav.id}
                type="button"
                onClick={() => addVariant(fav.name, fav.hex)}
                disabled={isAdded}
                title={`${fav.name} (Favori boutique)`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 9px",
                  borderRadius: 8,
                  border: `1.5px solid ${isAdded ? colors.primary : colors.borderField}`,
                  background: isAdded ? colors.bgInfo : "#fff",
                  cursor: isAdded ? "default" : "pointer",
                  fontSize: 12,
                  fontFamily: fonts.ui,
                  color: isAdded ? colors.primary : colors.ink,
                  opacity: isAdded ? 0.8 : 1,
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: fav.hex,
                    border: "1px solid rgba(0,0,0,0.12)",
                  }}
                />
                <span>{fav.name}</span>
                <span style={{ fontSize: 10, color: colors.gold }}>⭐</span>
              </button>
            );
          })}

          {/* Palette populaire */}
          {POPULAR_SWATCHES.map((swatch) => {
            const isAdded = variants.some(
              (v) => v.colorHex.toLowerCase() === swatch.hex.toLowerCase()
            );
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => addVariant(swatch.name, swatch.hex)}
                disabled={isAdded}
                title={swatch.name}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: swatch.hex,
                  border: `1.5px solid ${isAdded ? colors.primary : "rgba(0,0,0,0.12)"}`,
                  boxShadow: isAdded ? `0 0 0 2px ${colors.primary}` : "none",
                  cursor: isAdded ? "default" : "pointer",
                  opacity: isAdded ? 0.4 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isAdded && <Icon path={ICONS.check} size={13} stroke="#fff" />}
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
            Total stock : {totalStock} unités
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {variants.map((variant, index) => (
              <div
                key={variant.id || `${variant.colorHex}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${colors.borderSoft}`,
                  background: variant.active ? "#fff" : colors.rowAlt,
                  opacity: variant.active ? 1 : 0.65,
                }}
              >
                {/* Pastille de couleur */}
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: variant.colorHex,
                    border: "1px solid rgba(0,0,0,0.15)",
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
                      font: `600 13px ${fonts.ui}`,
                      color: colors.ink,
                      background: "transparent",
                    }}
                  />
                  <div style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>
                    {variant.colorHex}
                  </div>
                </div>

                {/* Saisie Stock unitaire */}
                <div style={{ width: 85 }}>
                  <NumericField
                    mode="integer"
                    value={String(variant.stock)}
                    onChange={(v) => updateVariant(index, { stock: Math.max(0, parseInt(v, 10) || 0) })}
                    placeholder="0"
                    min={0}
                  />
                </div>

                {/* Interrupteur Actif */}
                <button
                  type="button"
                  onClick={() => updateVariant(index, { active: !variant.active })}
                  title={variant.active ? "Variante active (cliquer pour désactiver)" : "Variante inactive (cliquer pour activer)"}
                  style={{
                    border: "none",
                    background: variant.active ? colors.bgSuccess : colors.bgDanger,
                    color: variant.active ? colors.fgSuccess : colors.fgDanger,
                    borderRadius: 6,
                    padding: "4px 7px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {variant.active ? "Actif" : "Masqué"}
                </button>

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  title="Supprimer cette variante"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 6,
                    color: colors.muted,
                    borderRadius: 6,
                  }}
                >
                  <Icon path={ICONS.trash} size={15} />
                </button>
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
    </div>
  );
}
