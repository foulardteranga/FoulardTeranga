"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import {
  createProduct,
  updateProductImages,
  updateProductVariants,
  adjustStock,
  getProductStockMovements,
  archiveProduct,
  restoreProduct,
  deleteProduct,
  deleteProductImage,
} from "@/lib/inventory/actions";
import type { StockMovementView } from "@/lib/data/stockMovements.server";
import { PRODUCT_CATEGORIES } from "@/lib/validators/product";
import { MANUAL_STOCK_REASONS } from "@/lib/validators/stockMovement";
import { ProductPhotosField } from "@/components/dashboard/ProductPhotosField";
import { ProductVariantsField, type ProductVariantItem } from "@/components/dashboard/ProductVariantsField";
import { NumericField } from "@/components/ui/NumericField";
import type { Product } from "@/lib/data/types";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/lowStockThreshold";

function lvlDot(v: number, seuil: number): string {
  if (v <= Math.round(seuil * 0.5)) return colors.danger;
  if (v <= seuil) return colors.warning;
  return colors.success;
}

const PAGE_SIZE = 8;

export function InventoryScreen({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const router = useRouter();
  const showToast = useBackoffice((s) => s.showToast);

  const totalCount = products.length;
  const activeCount = useMemo(() => products.filter((p) => p.active !== false).length, [products]);
  const archivedCount = useMemo(() => products.filter((p) => p.active === false).length, [products]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
        if (!matchesQuery) return false;
        const isActive = p.active !== false;
        if (statusFilter === "active") return isActive;
        if (statusFilter === "archived") return !isActive;
        return true;
      }),
    [products, q, statusFilter]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const drawerProduct = drawerId ? products.find((p) => p.id === drawerId) ?? null : null;

  async function handleToggleActive(p: Product, e: React.MouseEvent) {
    e.stopPropagation();
    setTogglingId(p.id);
    const isActive = p.active !== false;
    if (isActive) {
      const res = await archiveProduct(p.id);
      setTogglingId(null);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(`« ${p.name} » a été désactivé et masqué de la vitrine.`, "success");
    } else {
      const res = await restoreProduct(p.id);
      setTogglingId(null);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      showToast(`« ${p.name} » a été réactivé sur la vitrine.`, "success");
    }
    router.refresh();
  }

  return (
    <div className="ft-pad">
      {/* toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div
          style={{
            flex: 1,
            minWidth: 180,
            display: "flex",
            alignItems: "center",
            height: 42,
            padding: "0 13px",
            border: `1.5px solid ${colors.borderField}`,
            borderRadius: 10,
            background: "#fff",
            gap: 9,
          }}
        >
          <Icon path={ICONS.search} size={17} stroke={colors.muted} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un produit, une référence…"
            style={{ flex: 1, border: "none", outline: "none", font: `400 14px ${fonts.ui}`, background: "transparent" }}
          />
        </div>
        <ToolbarBtn icon={ICONS.download} label="Importer CSV" />
        <ToolbarBtn icon={ICONS.upload} label="Exporter" />
        <button
          onClick={() => setCreating(true)}
          className="ft-primary-btn"
          style={{
            height: 42,
            padding: "0 16px",
            border: "none",
            borderRadius: 10,
            background: colors.primary,
            color: "#fff",
            font: `600 13px ${fonts.ui}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon path={ICONS.plus} size={17} stroke="#fff" strokeWidth={2} />
          Produit
        </button>
      </div>

      {/* tabs de statut */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
        {[
          { key: "all", label: "Tous", count: totalCount },
          { key: "active", label: "Actifs", count: activeCount },
          { key: "archived", label: "Archivés", count: archivedCount },
        ].map((tab) => {
          const on = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key as "all" | "active" | "archived");
                setPage(1);
              }}
              style={{
                height: 36,
                padding: "0 13px",
                borderRadius: 10,
                cursor: "pointer",
                whiteSpace: "nowrap",
                border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                background: on ? colors.primary : "#fff",
                color: on ? "#fff" : colors.muted,
                font: `600 12.5px ${fonts.ui}`,
                display: "flex",
                alignItems: "center",
                gap: 7,
                transition: "all .15s ease",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: 11,
                  background: on ? "rgba(255,255,255,.22)" : "#F1ECE2",
                  color: on ? "#fff" : colors.muted,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* table */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
            <thead>
              <tr style={{ background: colors.ivory, color: colors.muted, textAlign: "left" }}>
                <th style={th("16px")}>Produit</th>
                <th style={th("10px")}>Variante</th>
                <th style={{ ...th("10px"), textAlign: "center" }}>Stock</th>
                <th style={{ ...th("10px"), textAlign: "right" }}>Prix</th>
                <th style={{ ...th("16px"), textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "48px 16px", textAlign: "center", color: colors.muted }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Aucun produit trouvé</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {q ? "Aucun produit ne correspond à votre recherche." : "Aucun produit dans cet état."}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((p, i) => {
                  const isArchived = p.active === false;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setDrawerId(p.id)}
                      className="ft-hover-row"
                      style={{
                        borderTop: "1px solid #EFEAE0",
                        background: i % 2 ? colors.rowAlt : "#fff",
                        cursor: "pointer",
                        opacity: isArchived ? 0.8 : 1,
                      }}
                    >
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" style={{ width: 34, height: 34, borderRadius: 8, flex: "none", objectFit: "cover" }} />
                          ) : (
                            <span style={{ width: 34, height: 34, borderRadius: 8, flex: "none", background: p.swatch }} />
                          )}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                              {isArchived ? (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: 6,
                                    background: "#F1ECE2",
                                    color: colors.muted,
                                    border: `1px solid ${colors.borderSoft}`,
                                  }}
                                >
                                  Archivé
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: 6,
                                    background: colors.bgSuccess,
                                    color: colors.fgSuccess,
                                    border: "1px solid rgba(46,125,50,.18)",
                                  }}
                                >
                                  Actif
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#9a8f7d", marginTop: 2 }}>REF-{p.id.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 10, color: colors.muted }}>
                        <div style={{ fontWeight: 500, color: colors.ink }}>{p.variant}</div>
                        {p.variants && p.variants.length > 0 && (
                          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 4 }}>
                            {p.variants.slice(0, 5).map((v) => (
                              <span
                                key={v.id || v.colorHex}
                                title={`${v.colorName} (${v.stock} en stock)`}
                                style={{
                                  width: 13,
                                  height: 13,
                                  borderRadius: 3,
                                  background: v.colorHex,
                                  border: "1px solid rgba(0,0,0,0.15)",
                                  display: "inline-block",
                                  opacity: v.stock === 0 ? 0.35 : 1,
                                }}
                              />
                            ))}
                            {p.variants.length > 5 && (
                              <span style={{ fontSize: 10, color: colors.muted }}>+{p.variants.length - 5}</span>
                            )}
                            <span style={{ fontSize: 11, color: colors.muted, marginLeft: 2 }}>
                              ({p.variants.length} teinte{p.variants.length > 1 ? "s" : ""})
                            </span>
                          </div>
                        )}
                      </td>
                      <StockCell value={p.stock} dot={lvlDot(p.stock, LOW_STOCK_THRESHOLD)} />
                      <td style={{ padding: 10, textAlign: "right", fontWeight: 600 }}>{money(p.price)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <div
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setDrawerId(p.id)}
                            title="Mouvement & gestion des stocks"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              height: 32,
                              padding: "0 9px",
                              border: `1px solid ${colors.borderField}`,
                              borderRadius: 8,
                              background: "#fff",
                              color: colors.primary,
                              font: `600 12px ${fonts.ui}`,
                              cursor: "pointer",
                            }}
                          >
                            Mouvement
                            <Icon path={ICONS.chevronRight} size={13} stroke="currentColor" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleActive(p, e)}
                            disabled={togglingId === p.id}
                            title={isArchived ? "Réactiver ce produit" : "Désactiver / Archiver ce produit"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              border: `1px solid ${colors.borderField}`,
                              borderRadius: 8,
                              background: isArchived ? "#F1ECE2" : "#fff",
                              color: isArchived ? colors.primary : colors.muted,
                              cursor: togglingId === p.id ? "default" : "pointer",
                              opacity: togglingId === p.id ? 0.6 : 1,
                            }}
                          >
                            <Icon path={isArchived ? ICONS.eye : ICONS.archive} size={15} strokeWidth={1.8} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingProduct(p);
                            }}
                            title="Supprimer définitivement ce produit"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              border: "1px solid rgba(198,40,40,.25)",
                              borderRadius: 8,
                              background: "#fff",
                              color: colors.danger,
                              cursor: "pointer",
                            }}
                          >
                            <Icon path={ICONS.trash} size={15} stroke={colors.danger} strokeWidth={1.8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${colors.borderSoft}`,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12.5, color: colors.muted }}>
            {filtered.length} produit{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} · {products.length} au total
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <PageBtn disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              ‹
            </PageBtn>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <PageBtn key={n} active={n === safePage} onClick={() => setPage(n)}>
                {n}
              </PageBtn>
            ))}
            <PageBtn disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
              ›
            </PageBtn>
          </div>
        </div>
      </div>

      {drawerProduct && (
        <EditDrawer
          product={drawerProduct}
          onClose={() => setDrawerId(null)}
          onDelete={(prod) => {
            setDrawerId(null);
            setDeletingProduct(prod);
          }}
        />
      )}
      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onDeleted={() => {
            setDeletingProduct(null);
            router.refresh();
          }}
        />
      )}
      {creating && (
        <NewProductDrawer
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function th(px: string): React.CSSProperties {
  return {
    padding: `11px ${px}`,
    font: `600 11.5px ${fonts.ui}`,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  };
}

function StockCell({ value, dot }: { value: number; dot: string }) {
  return (
    <td style={{ padding: 10, textAlign: "center" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 12.5px ${fonts.ui}` }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
        {value}
      </span>
    </td>
  );
}

function ToolbarBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      className="ft-hover-surface"
      style={{
        height: 42,
        padding: "0 14px",
        border: `1.5px solid ${colors.borderField}`,
        borderRadius: 10,
        background: "#fff",
        color: colors.ink,
        font: `600 13px ${fonts.ui}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon path={icon} size={16} stroke={colors.muted} strokeWidth={1.9} />
      {label}
    </button>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 32,
        minWidth: 32,
        padding: "0 9px",
        border: `1px solid ${active ? colors.primary : colors.borderField}`,
        borderRadius: 8,
        background: active ? colors.primary : "#fff",
        color: active ? "#fff" : disabled ? "#B6AEA1" : colors.ink,
        font: `600 12.5px ${fonts.ui}`,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

const SWATCH_PALETTE = ["#26326B", "#D07A34", "#C9A227", "#1E5F4E", "#7A2E5D", "#8a3a1c"];

interface NewProductForm {
  category: (typeof PRODUCT_CATEGORIES)[number];
  name: string;
  variant: string;
  motif: string;
  price: string;
  stock: string;
  swatch: string;
  lengths: string;
  description: string;
  image: string;
  gallery: string[];
}

const EMPTY_PRODUCT_FORM: NewProductForm = {
  category: "Foulards",
  name: "",
  variant: "",
  motif: "",
  price: "",
  stock: "",
  swatch: SWATCH_PALETTE[0],
  lengths: "",
  description: "",
  image: "",
  gallery: [],
};

function NewProductDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<NewProductForm>(EMPTY_PRODUCT_FORM);
  const [variants, setVariants] = useState<ProductVariantItem[]>([
    { colorName: "Bordeaux", colorHex: "#6B1D2F", stock: 0, active: true, position: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);
  const set = <K extends keyof NewProductForm>(k: K, v: NewProductForm[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const totalVariantStock = variants
    .filter((v) => v.active)
    .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  async function submit() {
    setSaving(true);
    const result = await createProduct({
      ...form,
      price: Number(form.price),
      stock: totalVariantStock,
      swatch: variants[0]?.colorHex ?? form.swatch,
      image: form.image || undefined,
      gallery: form.gallery,
      variants,
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("Produit ajouté avec ses variantes", "success");
    onCreated();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 50 }} />
      <div
        className="ft-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          maxWidth: "100vw",
          width: 440,
          background: "#fff",
          boxShadow: "-8px 0 32px rgba(60,40,20,.18)",
          display: "flex",
          flexDirection: "column",
          animation: "ft-fade .16s ease",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, fontFamily: fonts.display, fontWeight: 600, fontSize: 18 }}>Nouveau produit</div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: "none", background: "#F1ECE2", width: 34, height: 34, borderRadius: 999, fontSize: 18, cursor: "pointer", color: colors.muted }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          <FormField label="Nom du produit">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} style={textField} placeholder="Foulard tissé main" />
          </FormField>

          <FormField label="Photos">
            <ProductPhotosField
              image={form.image}
              gallery={form.gallery}
              onChange={({ image, gallery }) => setForm((s) => ({ ...s, image, gallery }))}
              onRemoveImage={async (url) => {
                await deleteProductImage(url);
              }}
            />
          </FormField>

          <FormField label="Catégorie">
            <select value={form.category} onChange={(e) => set("category", e.target.value as NewProductForm["category"])} style={textField}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Variante (modèle)">
              <input value={form.variant} onChange={(e) => set("variant", e.target.value)} style={textField} placeholder="Coton · Élégance" />
            </FormField>
            <FormField label="Motif">
              <input value={form.motif} onChange={(e) => set("motif", e.target.value)} style={textField} placeholder="Wax, Uni…" />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Prix (FCFA)">
              <NumericField mode="money" value={form.price} onChange={(v) => set("price", v)} placeholder="15000" min={0} />
            </FormField>
            {variants.length <= 1 ? (
              <FormField label="Stock disponible">
                <div>
                  <NumericField
                    mode="integer"
                    value={String(variants[0]?.stock ?? 0)}
                    onChange={(v) => {
                      const n = Math.max(0, parseInt(v, 10) || 0);
                      setVariants((prev) =>
                        prev.length > 0
                          ? [{ ...prev[0], stock: n }]
                          : [{ colorName: "Bordeaux", colorHex: form.swatch || "#6B1D2F", stock: n, active: true, position: 0 }]
                      );
                    }}
                    placeholder="0"
                    min={0}
                  />
                  <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                    Saisie directe (1 couleur)
                  </div>
                </div>
              </FormField>
            ) : (
              <FormField label={`Stock total (${variants.length} couleurs)`}>
                <div>
                  <div
                    style={{
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 13px",
                      background: colors.ivory,
                      borderRadius: 10,
                      border: `1.5px solid ${colors.borderField}`,
                      fontWeight: 700,
                      fontSize: 14,
                      color: colors.primary,
                    }}
                  >
                    <span>{totalVariantStock} {totalVariantStock <= 1 ? "unité" : "unités"}</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 6,
                        background: colors.bgInfo,
                        color: colors.primary,
                      }}
                    >
                      Somme auto
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("ft-product-variants-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: colors.primary,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 0 0 0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Détailler par couleur <Icon path={ICONS.chevronDown} size={13} />
                  </button>
                </div>
              </FormField>
            )}
          </div>

          <FormField label="Longueurs / tailles (séparées par une virgule)">
            <input value={form.lengths} onChange={(e) => set("lengths", e.target.value)} style={textField} placeholder="Taille unique" />
          </FormField>

          <div id="ft-product-variants-section">
            <FormField label="Couleurs & Variantes">
              <ProductVariantsField
                variants={variants}
                onChange={setVariants}
              />
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              style={{ ...textField, height: "auto", padding: "10px 13px", resize: "vertical" }}
            />
          </FormField>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${colors.borderSoft}`, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer" }}
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.name || !form.variant || !form.motif || !form.price || variants.length === 0}
            style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Création…" : "Créer le produit"}
          </button>
        </div>
      </div>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

const textField: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 13px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14px ${fonts.ui}`,
};

function EditDrawer({
  product: p,
  onClose,
  onDelete,
}: {
  product: Product;
  onClose: () => void;
  onDelete: (product: Product) => void;
}) {
  const router = useRouter();
  const showToast = useBackoffice((s) => s.showToast);
  const [isArchived, setIsArchived] = useState(p.active === false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [photos, setPhotos] = useState({ image: p.image ?? "", gallery: p.gallery });
  const [savingPhotos, setSavingPhotos] = useState(false);
  const photosDirty = photos.image !== (p.image ?? "") || photos.gallery.join("|") !== p.gallery.join("|");

  async function handleToggleActive() {
    setTogglingActive(true);
    if (!isArchived) {
      const res = await archiveProduct(p.id);
      setTogglingActive(false);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      setIsArchived(true);
      showToast(`« ${p.name} » a été désactivé et masqué de la vitrine.`, "success");
    } else {
      const res = await restoreProduct(p.id);
      setTogglingActive(false);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      setIsArchived(false);
      showToast(`« ${p.name} » a été réactivé sur la vitrine.`, "success");
    }
    router.refresh();
  }

  const initialVariants: ProductVariantItem[] = useMemo(() => {
    if (p.variants && p.variants.length > 0) {
      return p.variants.map((v) => ({
        id: v.id,
        colorName: v.colorName,
        colorHex: v.colorHex,
        stock: v.stock,
        active: v.active,
        sku: v.sku,
        image: v.image,
        position: v.position,
      }));
    }
    return [
      {
        colorName: p.variant || "Couleur unique",
        colorHex: p.swatch,
        stock: p.stock,
        active: true,
        position: 0,
      },
    ];
  }, [p]);

  const [variants, setVariants] = useState<ProductVariantItem[]>(initialVariants);
  const [savingVariants, setSavingVariants] = useState(false);
  const variantsDirty = JSON.stringify(variants) !== JSON.stringify(initialVariants);

  async function saveVariants() {
    setSavingVariants(true);
    const res = await updateProductVariants(p.id, variants);
    setSavingVariants(false);
    if (!res.ok) {
      showToast(res.error, "error");
      return;
    }
    showToast("Variantes enregistrées", "success");
    router.refresh();
  }

  const [movements, setMovements] = useState<StockMovementView[]>([]);
  const [movementsVersion, setMovementsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getProductStockMovements(p.id).then((res) => {
      if (!cancelled && res.ok) setMovements(res.movements);
    });
    return () => {
      cancelled = true;
    };
  }, [p.id, movementsVersion]);

  const [adjusting, setAdjusting] = useState(false);
  const [adjustVariantId, setAdjustVariantId] = useState("");
  const [adjustReason, setAdjustReason] = useState<(typeof MANUAL_STOCK_REASONS)[number]>("reception");
  const [adjustSign, setAdjustSign] = useState<"+" | "-">("+");
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  async function submitAdjustment() {
    setAdjustSaving(true);
    setAdjustError(null);
    const magnitude = Number(adjustQty) || 0;
    const delta = adjustSign === "+" ? magnitude : -magnitude;
    const res = await adjustStock({
      productId: p.id,
      variantId: adjustVariantId || undefined,
      delta,
      reason: adjustReason,
      note: adjustNote.trim() || undefined,
    });
    setAdjustSaving(false);
    if (!res.ok) {
      setAdjustError(res.error);
      return;
    }
    showToast("Stock ajusté.", "success");
    setAdjusting(false);
    setAdjustQty("1");
    setAdjustNote("");
    setMovementsVersion((v) => v + 1);
    router.refresh();
  }

  async function savePhotos() {
    setSavingPhotos(true);
    const res = await updateProductImages(p.id, {
      image: photos.image || null,
      gallery: photos.gallery,
    });
    setSavingPhotos(false);
    if (!res.ok) { showToast(res.error, "error"); return; }
    showToast("Photos enregistrées", "success");
    router.refresh();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 50 }} />
      <div
        className="ft-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          maxWidth: "100vw",
          background: "#fff",
          boxShadow: "-8px 0 32px rgba(60,40,20,.18)",
          display: "flex",
          flexDirection: "column",
          animation: "ft-fade .16s ease",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", alignItems: "center", gap: 12 }}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, flex: "none", objectFit: "cover" }} />
          ) : (
            <span style={{ width: 44, height: 44, borderRadius: 10, flex: "none", background: p.swatch }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, lineHeight: 1.15 }}>{p.name}</div>
              {isArchived ? (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: "#F1ECE2",
                    color: colors.muted,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  Archivé
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: colors.bgSuccess,
                    color: colors.fgSuccess,
                    border: "1px solid rgba(46,125,50,.18)",
                  }}
                >
                  Actif
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9a8f7d", marginTop: 2 }}>
              REF-{p.id.toUpperCase()} · {p.cat}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: "none", background: "#F1ECE2", width: 34, height: 34, borderRadius: 999, fontSize: 18, cursor: "pointer", color: colors.muted }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          <div style={sectionLabel}>Photos</div>
          <div style={{ marginBottom: 22 }}>
            <ProductPhotosField
              image={photos.image}
              gallery={photos.gallery}
              onChange={setPhotos}
              onRemoveImage={async (url) => {
                const res = await deleteProductImage(url, p.id);
                if (!res.ok) {
                  showToast(res.error, "error");
                  return;
                }
                showToast("Image supprimée de la base de données et du stockage", "success");
                router.refresh();
              }}
            />
            {photosDirty && (
              <button
                onClick={savePhotos}
                disabled={savingPhotos}
                className="ft-primary-btn"
                style={{ marginTop: 10, height: 40, padding: "0 16px", border: "none", borderRadius: 9, background: colors.primary, color: "#fff", font: `600 13px ${fonts.ui}`, cursor: savingPhotos ? "default" : "pointer", opacity: savingPhotos ? 0.7 : 1 }}
              >
                {savingPhotos ? "Enregistrement…" : "Enregistrer les photos"}
              </button>
            )}
          </div>

          <div style={sectionLabel}>Couleurs & Variantes</div>
          <div style={{ marginBottom: 22 }}>
            <ProductVariantsField variants={variants} onChange={setVariants} />
            {variantsDirty && (
              <button
                type="button"
                onClick={saveVariants}
                disabled={savingVariants}
                className="ft-primary-btn"
                style={{
                  marginTop: 10,
                  height: 40,
                  padding: "0 16px",
                  border: "none",
                  borderRadius: 9,
                  background: colors.primary,
                  color: "#fff",
                  font: `600 13px ${fonts.ui}`,
                  cursor: savingVariants ? "default" : "pointer",
                  opacity: savingVariants ? 0.7 : 1,
                }}
              >
                {savingVariants ? "Enregistrement…" : "Enregistrer les variantes"}
              </button>
            )}
          </div>

          <div style={sectionLabel}>Stock consolidé</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 999, background: lvlDot(p.stock, LOW_STOCK_THRESHOLD), flex: "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  {variants.length > 1 ? "Stock total consolidé" : "Stock total"}
                </div>
                <div style={{ fontSize: 11.5, color: colors.muted }}>
                  {variants.length > 1
                    ? `Somme automatique des ${variants.length} couleurs ci-dessus`
                    : `Seuil d'alerte : ${LOW_STOCK_THRESHOLD} unités`}
                </div>
              </div>
              <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22, color: lvlDot(p.stock, LOW_STOCK_THRESHOLD) }}>{p.stock}</span>
            </div>
          </div>

          <div style={sectionLabel}>Mouvement de stock</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            <MoveBtn color={colors.success} bg={colors.bgSuccess} fg={colors.fgSuccess} icon={ICONS.plus} label="Entrée" />
            <MoveBtn color={colors.danger} bg={colors.bgDanger} fg={colors.fgDanger} icon={ICONS.minus} label="Sortie" />
            <button
              type="button"
              onClick={() => setAdjusting((v) => !v)}
              style={{
                height: 44,
                border: `1.5px solid ${adjusting ? colors.primary : colors.borderField}`,
                borderRadius: 10,
                background: adjusting ? colors.bgInfo : "#fff",
                color: colors.primary,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon path={ICONS.refresh} size={15} stroke={colors.primary} strokeWidth={1.9} />
              Ajuster
            </button>
          </div>

          {adjusting && (
            <div style={{ border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              {variants.length > 0 && (
                <FormField label="Variante ciblée">
                  <select
                    value={adjustVariantId}
                    onChange={(e) => setAdjustVariantId(e.target.value)}
                    style={textField}
                  >
                    <option value="">Ajustement global (produit entier)</option>
                    {variants.map((v) => (
                      <option key={v.id || v.colorHex} value={v.id ?? ""}>
                        {v.colorName} ({v.colorHex}) — Stock : {v.stock}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
              <FormField label="Raison">
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as (typeof MANUAL_STOCK_REASONS)[number])}
                  style={textField}
                >
                  <option value="reception">Entrée atelier / Réception</option>
                  <option value="perte">Perte ou casse</option>
                  <option value="correction">Correction d&apos;inventaire</option>
                </select>
              </FormField>
              <FormField label="Écart">
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setAdjustSign("+")}
                    style={{
                      width: 44,
                      height: 42,
                      border: `1.5px solid ${adjustSign === "+" ? colors.success : colors.borderField}`,
                      borderRadius: 10,
                      background: adjustSign === "+" ? colors.bgSuccess : "#fff",
                      color: adjustSign === "+" ? colors.fgSuccess : colors.muted,
                      fontWeight: 700,
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustSign("-")}
                    style={{
                      width: 44,
                      height: 42,
                      border: `1.5px solid ${adjustSign === "-" ? colors.danger : colors.borderField}`,
                      borderRadius: 10,
                      background: adjustSign === "-" ? colors.bgDanger : "#fff",
                      color: adjustSign === "-" ? colors.fgDanger : colors.muted,
                      fontWeight: 700,
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>
                  <div style={{ flex: 1 }}>
                    <NumericField mode="integer" value={adjustQty} onChange={setAdjustQty} min={1} placeholder="1" />
                  </div>
                </div>
              </FormField>
              <FormField label="Note (optionnel)">
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Précision sur ce mouvement…"
                  style={{ ...textField, height: 64, padding: "10px 13px", resize: "none" }}
                />
              </FormField>
              {adjustError && <p style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 12px" }}>{adjustError}</p>}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdjusting(false)}
                  style={{
                    flex: 1,
                    height: 42,
                    border: `1.5px solid ${colors.borderField}`,
                    borderRadius: 10,
                    background: "#fff",
                    color: colors.primary,
                    font: `600 13px ${fonts.ui}`,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitAdjustment}
                  disabled={adjustSaving}
                  className="ft-primary-btn"
                  style={{
                    flex: 1,
                    height: 42,
                    border: "none",
                    borderRadius: 10,
                    background: colors.primary,
                    color: "#fff",
                    font: `600 13px ${fonts.ui}`,
                    cursor: adjustSaving ? "default" : "pointer",
                    opacity: adjustSaving ? 0.7 : 1,
                  }}
                >
                  {adjustSaving ? "Enregistrement…" : "Confirmer l'ajustement"}
                </button>
              </div>
            </div>
          )}

          {/* Section Statut & Actions */}
          <div style={sectionLabel}>Visibilité & Actions</div>
          <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: 14, marginBottom: 22 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: colors.ink }}>
                {isArchived ? "Produit actuellement archivé (inactif)" : "Produit actuellement actif en vente"}
              </div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 1.4 }}>
                {isArchived
                  ? "Ce produit est masqué de la vitrine publique et du point de vente (POS). Vous pouvez le réactiver à tout moment."
                  : "Ce produit est disponible à la vente sur la boutique en ligne, le catalogue et la caisse (POS)."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={togglingActive}
                style={{
                  height: 38,
                  padding: "0 13px",
                  borderRadius: 9,
                  border: `1.5px solid ${colors.borderField}`,
                  background: "#fff",
                  color: colors.primary,
                  font: `600 12.5px ${fonts.ui}`,
                  cursor: togglingActive ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: togglingActive ? 0.6 : 1,
                }}
              >
                <Icon path={isArchived ? ICONS.eye : ICONS.archive} size={15} strokeWidth={1.8} />
                {isArchived ? "Réactiver le produit" : "Désactiver / Archiver"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(p)}
                style={{
                  height: 38,
                  padding: "0 13px",
                  borderRadius: 9,
                  border: "1.5px solid rgba(198,40,40,.3)",
                  background: "#fff",
                  color: colors.danger,
                  font: `600 12.5px ${fonts.ui}`,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon path={ICONS.trash} size={15} stroke={colors.danger} strokeWidth={1.8} />
                Supprimer le produit
              </button>
            </div>
          </div>

          <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Derniers mouvements</div>
            {movements.length === 0 ? (
              <p style={{ fontSize: 12.5, color: colors.muted, margin: 0 }}>Aucun mouvement enregistré.</p>
            ) : (
              movements.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5 }}>
                  <span style={{ color: colors.muted }}>
                    {m.date} · {m.reasonLabel} · par {m.authorName}
                  </span>
                  <span style={{ fontWeight: 600, color: m.delta >= 0 ? colors.fgSuccess : colors.fgDanger }}>
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${colors.borderSoft}`, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: "pointer" }}
          >
            Fermer
          </button>
        </div>
      </div>
    </>
  );
}

function DeleteProductModal({
  product,
  onClose,
  onDeleted,
}: {
  product: Product;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);

  async function submit() {
    setSaving(true);
    const result = await deleteProduct(product.id);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(`Produit « ${product.name} » supprimé avec succès.`, "success");
    onDeleted();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,27,24,.4)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "ft-fade .16s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: 440,
          maxWidth: "92vw",
          padding: "24px",
          boxShadow: "0 20px 50px rgba(30,27,24,.24)",
        }}
      >
        <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19, marginBottom: 4, color: colors.ink }}>
          Supprimer le produit
        </div>
        <div style={{ fontSize: 13, color: colors.muted, marginBottom: 14 }}>
          {product.name} · REF-{product.id.toUpperCase()}
        </div>

        <div
          style={{
            background: colors.bgDanger,
            color: colors.fgDanger,
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.45,
            marginBottom: 16,
            border: "1px solid rgba(198,40,40,.2)",
          }}
        >
          <strong>Attention :</strong> Cette action supprimera définitivement le produit, ses variantes et ses images.
          <br />
          Si ce produit a déjà fait l&apos;objet de commandes enregistrées, la suppression sera refusée pour protéger votre historique et vous pourrez le désactiver / archiver à la place.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1,
              height: 44,
              border: `1.5px solid ${colors.borderField}`,
              borderRadius: 10,
              background: "#fff",
              color: colors.primary,
              font: `600 13.5px ${fonts.ui}`,
              cursor: saving ? "default" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            style={{
              flex: 1.5,
              height: 44,
              border: "none",
              borderRadius: 10,
              background: colors.danger,
              color: "#fff",
              font: `600 13.5px ${fonts.ui}`,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  font: `600 12px ${fonts.ui}`,
  textTransform: "uppercase",
  letterSpacing: ".06em",
  color: colors.muted,
  marginBottom: 12,
};

function MoveBtn({ color, bg, fg, icon, label }: { color: string; bg: string; fg: string; icon: string; label: string }) {
  return (
    <button
      style={{
        height: 44,
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        background: bg,
        color: fg,
        font: `600 13px ${fonts.ui}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Icon path={icon} size={15} stroke={color} strokeWidth={2} />
      {label}
    </button>
  );
}
