"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { money } from "@/lib/format";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { createProduct, updateProductImages, adjustStock, getProductStockMovements } from "@/lib/inventory/actions";
import type { StockMovementView } from "@/lib/data/stockMovements.server";
import { PRODUCT_CATEGORIES } from "@/lib/validators/product";
import { MANUAL_STOCK_REASONS } from "@/lib/validators/stockMovement";
import { ProductPhotosField } from "@/components/dashboard/ProductPhotosField";
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
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const router = useRouter();

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      products.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      ),
    [products, q]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const drawerProduct = drawerId ? products.find((p) => p.id === drawerId) ?? null : null;

  return (
    <div className="ft-pad">
      {/* toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
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

      {/* table */}
      <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
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
              {rows.map((p, i) => {
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDrawerId(p.id)}
                    className="ft-hover-row"
                    style={{ borderTop: "1px solid #EFEAE0", background: i % 2 ? colors.rowAlt : "#fff", cursor: "pointer" }}
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
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#9a8f7d" }}>REF-{p.id.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: 10, color: colors.muted }}>{p.variant}</td>
                    <StockCell value={p.stock} dot={lvlDot(p.stock, LOW_STOCK_THRESHOLD)} />
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 600 }}>{money(p.price)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: `600 12px ${fonts.ui}`, color: colors.primary }}>
                        Mouvement
                        <Icon path={ICONS.chevronRight} size={14} stroke="currentColor" strokeWidth={2} />
                      </span>
                    </td>
                  </tr>
                );
              })}
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
            {filtered.length} produits · {products.length} au total
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

      {drawerProduct && <EditDrawer product={drawerProduct} onClose={() => setDrawerId(null)} />}
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
  const [saving, setSaving] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);
  const set = <K extends keyof NewProductForm>(k: K, v: NewProductForm[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  async function submit() {
    setSaving(true);
    const result = await createProduct({
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      image: form.image || undefined,
      gallery: form.gallery,
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("Produit ajouté", "success");
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
          width: 420,
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
            <FormField label="Variante">
              <input value={form.variant} onChange={(e) => set("variant", e.target.value)} style={textField} placeholder="Coton · Bleu nuit" />
            </FormField>
            <FormField label="Motif">
              <input value={form.motif} onChange={(e) => set("motif", e.target.value)} style={textField} placeholder="Wax, Uni…" />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Prix (FCFA)">
              <NumericField mode="money" value={form.price} onChange={(v) => set("price", v)} placeholder="15000" min={0} />
            </FormField>
            <FormField label="Stock initial">
              <NumericField mode="integer" value={form.stock} onChange={(v) => set("stock", v)} placeholder="10" min={0} />
            </FormField>
          </div>

          <FormField label="Longueurs / tailles (séparées par une virgule)">
            <input value={form.lengths} onChange={(e) => set("lengths", e.target.value)} style={textField} placeholder="Taille unique" />
          </FormField>

          <FormField label="Couleur">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SWATCH_PALETTE.map((h) => (
                <button
                  key={h}
                  onClick={() => set("swatch", h)}
                  aria-label={h}
                  style={{ width: 34, height: 34, borderRadius: 9, cursor: "pointer", background: h, border: `3px solid ${form.swatch === h ? colors.ink : "transparent"}` }}
                />
              ))}
            </div>
          </FormField>

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
            disabled={saving || !form.name || !form.variant || !form.motif || !form.price || !form.stock}
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

function EditDrawer({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const router = useRouter();
  const showToast = useBackoffice((s) => s.showToast);
  const [photos, setPhotos] = useState({ image: p.image ?? "", gallery: p.gallery });
  const [savingPhotos, setSavingPhotos] = useState(false);
  const photosDirty = photos.image !== (p.image ?? "") || photos.gallery.join("|") !== p.gallery.join("|");

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
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, lineHeight: 1.15 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: "#9a8f7d" }}>
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
            <ProductPhotosField image={photos.image} gallery={photos.gallery} onChange={setPhotos} />
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

          <div style={sectionLabel}>Stock</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 999, background: lvlDot(p.stock, LOW_STOCK_THRESHOLD), flex: "none" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Stock actuel</div>
                <div style={{ fontSize: 11.5, color: colors.muted }}>Seuil d&apos;alerte {LOW_STOCK_THRESHOLD}</div>
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
            Annuler
          </button>
          <button
            onClick={onClose}
            style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: "pointer" }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </>
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
