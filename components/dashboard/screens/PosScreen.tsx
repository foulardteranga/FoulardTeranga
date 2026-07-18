"use client";

import { useMemo, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { categories } from "@/lib/data/catalog";
import { money } from "@/lib/format";
import { useBackoffice, type CartLine } from "@/lib/store/useBackoffice";
import { encaisserVente } from "@/lib/pos/actions";
import type { Customer, Product } from "@/lib/data/types";

const PAY_DEF = [
  { id: "espece", label: "Espèces", icon: ICONS.cash },
  { id: "mm", label: "Mobile M.", icon: ICONS.mobileMoney },
  { id: "mixte", label: "Mixte", icon: ICONS.mixte },
] as const;

const PAY_LABELS: Record<"espece" | "mm" | "mixte", string> = {
  espece: "Espèces",
  mm: "Mobile Money",
  mixte: "Mixte",
};

export function PosScreen({ products, customers }: { products: Product[]; customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof categories)[number]>("Tous");

  const cart = useBackoffice((s) => s.cart);
  const cartOpen = useBackoffice((s) => s.cartOpen);
  const showToast = useBackoffice((s) => s.showToast);
  const openCart = useBackoffice((s) => s.openCart);
  const closeCart = useBackoffice((s) => s.closeCart);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      products.filter(
        (p) => (cat === "Tous" || p.cat === cat) && (!q || p.name.toLowerCase().includes(q))
      ),
    [products, cat, q]
  );

  const sub = cart.reduce((a, l) => a + l.price * l.qty, 0);
  const disc = cart.reduce((a, l) => a + l.discount * l.qty, 0);
  const total = sub - disc;
  const cartCount = cart.reduce((a, l) => a + l.qty, 0);

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "stretch", minHeight: "100%" }}>
      {/* catalogue */}
      <div className="ft-pad" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              height: 46,
              padding: "0 14px",
              border: `1.5px solid ${colors.borderField}`,
              borderRadius: 10,
              background: "#fff",
              gap: 10,
            }}
          >
            <Icon path={ICONS.search} size={18} stroke={colors.muted} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit…"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                font: `400 15px ${fonts.ui}`,
                color: colors.ink,
                background: "transparent",
              }}
            />
          </div>
          <button
            onClick={() => showToast("Scanner de code-barres…", "success")}
            style={{
              height: 46,
              padding: "0 16px",
              border: `1.5px solid ${colors.primary}`,
              borderRadius: 10,
              background: "#EEF0F7",
              color: colors.primary,
              font: `600 14px ${fonts.ui}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 9,
              flex: "none",
            }}
          >
            <Icon path={ICONS.scan} size={19} stroke={colors.primary} />
            <span style={{ whiteSpace: "nowrap" }}>Scanner</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {categories.map((c) => {
            const on = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  height: 38,
                  padding: "0 15px",
                  borderRadius: 999,
                  font: `600 13px ${fonts.ui}`,
                  cursor: "pointer",
                  border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                  background: on ? colors.primary : "#fff",
                  color: on ? "#fff" : colors.muted,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: colors.muted }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#F1ECE2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <Icon path={ICONS.search} size={26} stroke="#B6AEA1" strokeWidth={1.6} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: colors.ink, marginBottom: 4 }}>
              Aucun produit trouvé
            </div>
            <div style={{ fontSize: 13.5 }}>Essayez un autre mot-clé ou changez de catégorie.</div>
          </div>
        ) : (
          <div className="ft-pos-grid">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {/* cart desktop */}
      <CartPanelDesktop total={total} sub={sub} disc={disc} customers={customers} />

      {/* mobile cart bar */}
      {cartCount > 0 && !cartOpen && (
        <div
          className="ft-mobile-only"
          onClick={openCart}
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 70,
            zIndex: 35,
            height: 56,
            borderRadius: 14,
            background: colors.primary,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            boxShadow: "0 8px 24px rgba(38,50,107,.34)",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 14 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: "rgba(255,255,255,.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
              }}
            >
              {cartCount}
            </span>
            Voir le panier
          </span>
          <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 19 }}>
            {money(total)}
          </span>
        </div>
      )}

      {/* mobile cart sheet */}
      {cartOpen && <CartSheetMobile total={total} onClose={closeCart} customers={customers} />}

      {/* spacer to clear the fixed mobile cart bar */}
      {cartCount > 0 && <div className="ft-mobile-only" style={{ height: 60 }} aria-hidden />}
    </div>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  const addToCart = useBackoffice((s) => s.addToCart);
  return (
    <div
      onClick={() => addToCart(p)}
      className="ft-card-hover"
      style={{
        background: "#fff",
        border: "1px solid rgba(30,27,24,.08)",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(60,40,20,.06)",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1",
          background: p.swatch,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 10, color: "rgba(30,27,24,.35)" }}>
          {p.id.toUpperCase()}
        </span>
        {p.stock <= 6 && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              font: `600 10px ${fonts.ui}`,
              padding: "3px 7px",
              borderRadius: 6,
              background: colors.bgWarning,
              color: colors.fgWarning,
            }}
          >
            Stock {p.stock}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13.5,
            lineHeight: 1.25,
            marginBottom: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.name}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: colors.muted,
            marginBottom: 7,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {p.variant}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: colors.primary }}>{money(p.price)}</div>
      </div>
    </div>
  );
}

/* ----- Client attach block (shared) ----- */
function ClientBlock({ customers }: { customers: Customer[] }) {
  const client = useBackoffice((s) => s.client);
  const attachClient = useBackoffice((s) => s.attachClient);
  const detachClient = useBackoffice((s) => s.detachClient);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (client) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "#EEF0F7",
            color: colors.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 13,
            flex: "none",
          }}
        >
          {client.initials}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{client.name}</div>
          <div style={{ fontSize: 12, color: colors.gold, fontWeight: 600 }}>
            ★ {client.points} points fidélité
          </div>
        </div>
        <button
          onClick={detachClient}
          aria-label="Retirer la cliente"
          style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, fontSize: 18, padding: 4 }}
        >
          ×
        </button>
      </div>
    );
  }

  if (pickerOpen) {
    const q = query.trim().toLowerCase();
    const filtered = customers.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
    return (
      <div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher nom ou téléphone…"
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            border: `1.5px solid ${colors.borderField}`,
            borderRadius: 10,
            font: `400 13px ${fonts.ui}`,
            outline: "none",
          }}
        />
        <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 12.5, color: colors.muted, padding: "8px 2px" }}>Aucune cliente trouvée.</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  attachClient(c);
                  setPickerOpen(false);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 4px",
                  border: "none",
                  borderBottom: `1px solid ${colors.faintLine}`,
                  background: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                <span style={{ fontSize: 11.5, color: colors.muted }}>{c.phone}</span>
              </button>
            ))
          )}
        </div>
        <button
          onClick={() => {
            setPickerOpen(false);
            setQuery("");
          }}
          style={{ marginTop: 6, font: `500 12px ${fonts.ui}`, color: colors.muted, background: "none", border: "none", cursor: "pointer" }}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setPickerOpen(true)}
      style={{
        width: "100%",
        height: 42,
        border: `1.5px dashed ${colors.borderField}`,
        borderRadius: 10,
        background: colors.ivory,
        color: colors.primary,
        font: `600 13.5px ${fonts.ui}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Icon path={ICONS.personPlus} size={17} stroke={colors.primary} />
      Rattacher une cliente
    </button>
  );
}

/* ----- Pay methods (shared) ----- */
function PayMethods() {
  const pay = useBackoffice((s) => s.pay);
  const setPay = useBackoffice((s) => s.setPay);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 12 }}>
      {PAY_DEF.map((pm) => {
        const on = pay === pm.id;
        return (
          <button
            key={pm.id}
            onClick={() => setPay(pm.id)}
            style={{
              height: 52,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              font: `600 11.5px ${fonts.ui}`,
              border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
              background: on ? "#EEF0F7" : "#fff",
              color: on ? colors.primary : colors.muted,
            }}
          >
            <Icon path={pm.icon} size={18} stroke={on ? colors.primary : colors.muted} />
            {pm.label}
          </button>
        );
      })}
    </div>
  );
}

function PayButton({ total, big }: { total: number; big?: boolean }) {
  const cart = useBackoffice((s) => s.cart);
  const pay = useBackoffice((s) => s.pay);
  const client = useBackoffice((s) => s.client);
  const offline = useBackoffice((s) => s.offline);
  const showToast = useBackoffice((s) => s.showToast);
  const showTicket = useBackoffice((s) => s.showTicket);
  const [saving, setSaving] = useState(false);
  const has = cart.length > 0;
  const canPay = has && !offline && !saving;

  async function handlePay() {
    setSaving(true);
    const result = await encaisserVente({
      lines: cart.map((l) => ({ productId: l.id, qty: l.qty, discounted: l.discount > 0 })),
      paymentMethod: pay,
      customerId: client?.id ?? null,
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showTicket({
      items: cart.reduce((a, l) => a + l.qty, 0),
      pay: PAY_LABELS[pay],
      total: money(total),
      ref: result.ref,
    });
  }

  return (
    <button
      onClick={handlePay}
      disabled={!canPay}
      className="ft-primary-btn"
      style={{
        width: "100%",
        height: big ? 54 : 52,
        border: "none",
        borderRadius: 10,
        background: canPay ? colors.primary : colors.disabled,
        color: "#fff",
        font: `700 16px ${fonts.ui}`,
        cursor: canPay ? "pointer" : "not-allowed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {!big && !saving && <Icon path={ICONS.check} size={20} stroke="#fff" strokeWidth={2} />}
      {offline ? "Connexion requise" : saving ? "Encaissement…" : `Encaisser${has ? ` · ${money(total)}` : ""}`}
    </button>
  );
}

/* ----- Desktop cart aside ----- */
function CartPanelDesktop({ total, sub, disc, customers }: { total: number; sub: number; disc: number; customers: Customer[] }) {
  const cart = useBackoffice((s) => s.cart);
  const clearCart = useBackoffice((s) => s.clearCart);
  const cartCount = cart.reduce((a, l) => a + l.qty, 0);

  return (
    <aside
      className="ft-desktop-only"
      style={{
        width: 372,
        flex: "none",
        background: "#fff",
        borderLeft: "1px solid rgba(30,27,24,.08)",
        flexDirection: "column",
        position: "sticky",
        top: 65,
        height: "calc(100vh - 65px)",
        display: "flex",
      }}
    >
      <div
        style={{
          padding: "16px 18px 12px",
          borderBottom: `1px solid ${colors.borderSoft}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19 }}>Vente en cours</div>
        {cartCount > 0 && (
          <button
            onClick={clearCart}
            style={{ font: `500 12.5px ${fonts.ui}`, color: colors.fgDanger, background: "none", border: "none", cursor: "pointer" }}
          >
            Vider
          </button>
        )}
      </div>

      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${colors.borderSoft}` }}>
        <ClientBlock customers={customers} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {cart.length === 0 ? (
          <EmptyCart />
        ) : (
          cart.map((l) => <CartLineDesktop key={l.id} line={l} />)
        )}
      </div>

      <div style={{ borderTop: `1px solid ${colors.borderSoft}`, padding: "14px 18px", background: colors.rowAlt }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.muted, marginBottom: 5 }}>
          <span>Sous-total</span>
          <span>{money(sub)}</span>
        </div>
        {disc > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.fgSuccess, marginBottom: 5 }}>
            <span>Remises</span>
            <span>−{money(disc)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "8px 0 12px" }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Total</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 26, color: colors.primary }}>
            {money(total)}
          </span>
        </div>
        <PayMethods />
        <PayButton total={total} />
      </div>
    </aside>
  );
}

function EmptyCart() {
  return (
    <div style={{ textAlign: "center", padding: "50px 24px", color: colors.muted }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "#F1ECE2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <Icon path={ICONS.cart} size={26} stroke="#B6AEA1" strokeWidth={1.5} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 14.5, color: colors.ink, marginBottom: 4 }}>Panier vide</div>
      <div style={{ fontSize: 13 }}>Touchez un produit pour l&apos;ajouter à la vente.</div>
    </div>
  );
}

function CartLineDesktop({ line: l }: { line: CartLine }) {
  const incLine = useBackoffice((s) => s.incLine);
  const rmLine = useBackoffice((s) => s.rmLine);
  const toggleDiscount = useBackoffice((s) => s.toggleDiscount);
  const lineTotal = (l.price - l.discount) * l.qty;

  return (
    <div style={{ padding: "11px 18px", borderBottom: `1px solid ${colors.faintLine}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.25 }}>{l.name}</div>
          <div style={{ fontSize: 11.5, color: colors.muted }}>
            {l.variant} · {money(l.price)}
          </div>
        </div>
        <button
          onClick={() => rmLine(l.id)}
          aria-label="Retirer l'article"
          style={{ border: "none", background: "none", cursor: "pointer", color: "#B6AEA1", fontSize: 16, flex: "none", padding: "0 2px" }}
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stepper qty={l.qty} onDec={() => incLine(l.id, -1)} onInc={() => incLine(l.id, 1)} />
        <div style={{ textAlign: "right" }}>
          {l.discount > 0 && (
            <div style={{ fontSize: 11, color: "#9a8f7d", textDecoration: "line-through" }}>
              {money(l.price * l.qty)}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 14.5, color: colors.ink }}>{money(lineTotal)}</div>
          <button
            onClick={() => toggleDiscount(l.id)}
            style={{ font: `500 11px ${fonts.ui}`, color: colors.primary, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {l.discount > 0 ? "Retirer remise" : "Ajouter remise −10%"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ qty, onDec, onInc, big }: { qty: number; onDec: () => void; onInc: () => void; big?: boolean }) {
  const w = big ? 38 : 34;
  const h = big ? 38 : 34;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: h,
        border: `1.5px solid ${colors.borderField}`,
        borderRadius: 9,
        overflow: "hidden",
      }}
    >
      <button onClick={onDec} style={stepBtn(w)} aria-label="Diminuer">
        −
      </button>
      <span style={{ width: big ? 36 : 38, textAlign: "center", font: `600 14px ${fonts.ui}` }}>{qty}</span>
      <button onClick={onInc} style={stepBtn(w)} aria-label="Augmenter">
        +
      </button>
    </div>
  );
}

function stepBtn(w: number): React.CSSProperties {
  return {
    width: w,
    height: "100%",
    border: "none",
    background: colors.ivory,
    fontSize: w >= 38 ? 18 : 17,
    color: colors.primary,
    cursor: "pointer",
  };
}

/* ----- Mobile cart sheet ----- */
function CartSheetMobile({ total, onClose, customers }: { total: number; onClose: () => void; customers: Customer[] }) {
  const cart = useBackoffice((s) => s.cart);
  const incLine = useBackoffice((s) => s.incLine);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 50 }} />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          maxHeight: "88vh",
          background: "#fff",
          borderRadius: "18px 18px 0 0",
          display: "flex",
          flexDirection: "column",
          animation: "ft-slideup .22s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            borderBottom: `1px solid ${colors.borderSoft}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19 }}>Vente en cours</div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: "none", background: "#F1ECE2", width: 32, height: 32, borderRadius: 999, fontSize: 18, cursor: "pointer", color: colors.muted }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${colors.borderSoft}` }}>
          <ClientBlock customers={customers} />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "44px 24px", color: colors.muted }}>
              <div style={{ fontWeight: 600, color: colors.ink, marginBottom: 4 }}>Panier vide</div>
              <div style={{ fontSize: 13 }}>Touchez un produit pour l&apos;ajouter.</div>
            </div>
          ) : (
            cart.map((l) => (
              <div
                key={l.id}
                style={{
                  padding: "12px 18px",
                  borderBottom: `1px solid ${colors.faintLine}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>{money(l.price)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Stepper qty={l.qty} big onDec={() => incLine(l.id, -1)} onInc={() => incLine(l.id, 1)} />
                  <div style={{ fontWeight: 700, fontSize: 14, minWidth: 70, textAlign: "right" }}>
                    {money((l.price - l.discount) * l.qty)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ borderTop: `1px solid ${colors.borderSoft}`, padding: "14px 18px 22px", background: colors.rowAlt }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Total</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 26, color: colors.primary }}>
              {money(total)}
            </span>
          </div>
          <PayMethods />
          <PayButton total={total} big />
        </div>
      </div>
    </>
  );
}
