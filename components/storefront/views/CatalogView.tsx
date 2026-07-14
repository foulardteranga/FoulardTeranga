"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { filterCatalog, categories, type CatalogFilters } from "@/lib/data/catalog";
import { useStorefront } from "@/lib/store/useStorefront";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { money } from "@/lib/format";
import type { Product } from "@/lib/data/types";

const COLOR_SWATCHES = [
  { hex: "#26326B", label: "Indigo" },
  { hex: "#D07A34", label: "Terracotta" },
  { hex: "#C9A227", label: "Or" },
  { hex: "#0E9F6E", label: "Vert" },
  { hex: "#1E1B18", label: "Noir" },
];
const MOTIFS = ["Wax", "Bazin", "Uni", "Kente", "Tie & dye"];

export function CatalogView({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const initialCat = (searchParams.get("cat") as CatalogFilters["cat"]) || "Tous";

  const [filters, setFilters] = useState<CatalogFilters>({
    cat: initialCat,
    color: "",
    motif: "",
    priceMax: 40000,
    query: "",
    sort: "new",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(timer);
  }, [filters.cat, filters.color, filters.motif, filters.priceMax, filters.query, filters.sort]);

  const addToCart = useStorefront((s) => s.addToCart);
  const showToast = useStorefront((s) => s.showToast);

  const filtered = useMemo(() => filterCatalog(products, filters), [products, filters]);

  const setFilter = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters({ cat: "Tous", color: "", motif: "", priceMax: 40000, query: "", sort: "new" });

  return (
    <div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: filters.cat === "Tous" ? "Toute la boutique" : filters.cat }]} />
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-.01em" }}>
        {filters.cat === "Tous" ? "Toute la boutique" : filters.cat}
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 20px" }}>
        {filtered.length} produit{filtered.length > 1 ? "s" : ""}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", height: 46, padding: "0 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", gap: 10 }}>
          <Icon path={ICONS.search} size={18} stroke={colors.muted} strokeWidth={1.75} />
          <input
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder="Rechercher un foulard, un motif…"
            style={{ flex: 1, border: "none", outline: "none", font: `400 15px ${fonts.ui}`, color: colors.ink, background: "transparent" }}
          />
        </div>
        <select
          value={filters.sort}
          onChange={(e) => setFilter("sort", e.target.value as CatalogFilters["sort"])}
          style={{ height: 46, padding: "0 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `500 14px ${fonts.ui}`, color: colors.ink, cursor: "pointer" }}
        >
          <option value="new">Nouveautés</option>
          <option value="asc">Prix croissant</option>
          <option value="desc">Prix décroissant</option>
        </select>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="ft-mobile-only"
          style={{ height: 46, padding: "0 16px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `600 14px ${fonts.ui}`, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
        >
          <Icon path='<path d="M4 6h16M7 12h10M10 18h4"/>' size={18} stroke={colors.ink} strokeWidth={1.75} />
          Filtres
        </button>
      </div>

      <div className="ft-store-catalog-layout" style={{ display: "grid", gap: 24, alignItems: "start" }}>
        <aside
          className={filtersOpen ? undefined : "ft-desktop-only"}
          style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "20px 22px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ font: `600 15px ${fonts.ui}` }}>Filtres</span>
            <span onClick={clearFilters} style={{ font: `500 13px ${fonts.ui}`, color: colors.primary, cursor: "pointer" }}>
              Réinitialiser
            </span>
          </div>

          <FilterLabel>Catégorie</FilterLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
            {categories.map((c) => (
              <span
                key={c}
                onClick={() => setFilter("cat", c)}
                style={{
                  padding: "8px 10px", borderRadius: 8, font: `500 14px ${fonts.ui}`, cursor: "pointer",
                  background: filters.cat === c ? colors.bgInfo : "transparent",
                  color: filters.cat === c ? colors.primary : colors.ink,
                }}
              >
                {c}
              </span>
            ))}
          </div>

          <FilterLabel>Couleur</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            {COLOR_SWATCHES.map((c) => (
              <span
                key={c.hex}
                onClick={() => setFilter("color", filters.color === c.hex ? "" : c.hex)}
                title={c.label}
                style={{ width: 32, height: 32, borderRadius: 999, background: c.hex, cursor: "pointer", outline: filters.color === c.hex ? `2px solid ${colors.ink}` : "2px solid transparent", outlineOffset: 2 }}
              />
            ))}
          </div>

          <FilterLabel>Motif</FilterLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {MOTIFS.map((m) => {
              const active = filters.motif === m;
              return (
                <span
                  key={m}
                  onClick={() => setFilter("motif", active ? "" : m)}
                  style={{
                    height: 34, padding: "0 13px", display: "inline-flex", alignItems: "center", borderRadius: 999,
                    font: `600 13px ${fonts.ui}`, cursor: "pointer",
                    border: `1.5px solid ${active ? colors.primary : colors.borderField}`,
                    background: active ? colors.primary : "#fff",
                    color: active ? "#fff" : colors.muted,
                  }}
                >
                  {m}
                </span>
              );
            })}
          </div>

          <FilterLabel>Prix max · {money(filters.priceMax)}</FilterLabel>
          <input
            type="range"
            min={4000}
            max={40000}
            step={500}
            value={filters.priceMax}
            onChange={(e) => setFilter("priceMax", parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: colors.primary, cursor: "pointer" }}
          />
        </aside>

        <div>
          {loading ? (
            <div className="ft-store-catalog-grid" style={{ display: "grid", gap: 18 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
                  <div className="ft-skeleton" style={{ aspectRatio: "4 / 5" }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div className="ft-skeleton" style={{ height: 14, width: "70%", marginBottom: 9 }} />
                    <div className="ft-skeleton" style={{ height: 12, width: "45%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 999, background: "#F4F0E9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon path={ICONS.search} size={28} stroke="#B6AEA1" strokeWidth={1.6} />
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Aucun résultat</div>
              <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 20px", maxWidth: 320 }}>
                Aucun produit ne correspond à ces filtres. Essayez d&apos;élargir votre recherche.
              </p>
              <button
                onClick={clearFilters}
                style={{ height: 46, padding: "0 24px", border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, cursor: "pointer" }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="ft-store-catalog-grid" style={{ display: "grid", gap: 18 }}>
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  stock={p.stock}
                  onAdd={() => {
                    addToCart({ productId: p.id, name: p.name, variant: p.lengths[0], colorHex: p.colors[0], price: p.price });
                    showToast("Ajouté au panier", "success");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: `600 12px ${fonts.ui}`, textTransform: "uppercase", letterSpacing: ".06em", color: colors.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}
