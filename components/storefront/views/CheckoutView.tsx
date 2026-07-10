"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { Breadcrumb } from "@/components/storefront/Breadcrumb";
import { LoyaltyBadge } from "@/components/storefront/LoyaltyBadge";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { useShop, type WebCartLine } from "@/lib/store/useShop";
import { validateKyc, type KycFieldErrors } from "@/lib/validators/kyc";
import { cartSubtotal } from "@/lib/store/cartLogic";
import { money, fmt } from "@/lib/format";

export function CheckoutView() {
  const router = useRouter();
  const cart = useStorefront((s) => s.cart);
  const kyc = useStorefront((s) => s.kyc);
  const setKycField = useStorefront((s) => s.setKycField);
  const sending = useStorefront((s) => s.sending);
  const setSending = useStorefront((s) => s.setSending);
  const clearCart = useStorefront((s) => s.clearCart);
  const resetKyc = useStorefront((s) => s.resetKyc);
  const submitWebOrder = useShop((s) => s.submitWebOrder);

  const [errors, setErrors] = useState<KycFieldErrors>({});
  const subtotal = cartSubtotal(cart);

  if (cart.length === 0) {
    return (
      <div className="ft-store-page" style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: colors.muted, marginBottom: 12 }}>Votre panier est vide.</p>
        <Link href="/catalogue" style={{ color: colors.primary, fontWeight: 600 }}>Découvrir la boutique →</Link>
      </div>
    );
  }

  const handleSubmit = () => {
    const result = validateKyc(kyc);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSending(true);

    const lines: WebCartLine[] = cart.map((l) => ({
      productId: l.productId,
      name: l.name,
      variant: l.variant,
      price: l.price,
      qty: l.qty,
    }));

    setTimeout(() => {
      const order = submitWebOrder(result.data, lines);
      setSending(false);
      clearCart();
      resetKyc();
      router.push(`/confirmation?ref=${encodeURIComponent(order.id)}`);
    }, 600);
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 860, margin: "0 auto" }}>
      <Breadcrumb items={[{ label: "Panier", href: "/panier" }, { label: "Ma demande" }]} />
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-.01em" }}>
        Envoyer ma demande
      </h1>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 22px" }}>
        Quelques informations et c&apos;est parti — aucun paiement maintenant.
      </p>

      <div className="ft-store-checkout-layout" style={{ display: "grid", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "26px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: colors.bgInfo, borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
            <Icon path={ICONS.info} size={20} stroke={colors.primary} strokeWidth={1.75} style={{ flex: "none" }} />
            <span style={{ fontSize: 13.5, color: colors.primary, fontWeight: 500, lineHeight: 1.45 }}>
              La gérante vous contactera pour confirmer votre commande, le mode de livraison et le paiement.
            </span>
          </div>

          <Field label="Nom complet *" error={errors.name}>
            <input value={kyc.name} onChange={(e) => setKycField("name", e.target.value)} placeholder="Ex. Aya Koffi" style={inputStyle(!!errors.name)} />
          </Field>
          <Field label="Lieu de livraison *" error={errors.place}>
            <input value={kyc.place} onChange={(e) => setKycField("place", e.target.value)} placeholder="Ex. Plateau, Abidjan — quartier / repère" style={inputStyle(!!errors.place)} />
          </Field>
          <Field label="Numéro de contact *" error={errors.phone}>
            <input value={kyc.phone} onChange={(e) => setKycField("phone", e.target.value)} placeholder="Ex. +225 07 12 45 67 89" style={inputStyle(!!errors.phone)} />
          </Field>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>Note (optionnel)</label>
            <textarea
              value={kyc.note}
              onChange={(e) => setKycField("note", e.target.value)}
              placeholder="Une précision sur votre commande…"
              style={{ width: "100%", height: 80, padding: "12px 14px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", font: `400 15px ${fonts.ui}`, color: colors.ink, outline: "none", resize: "none" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 22 }}>
            <span
              onClick={() => setKycField("wa", !kyc.wa)}
              style={{ width: 44, height: 26, borderRadius: 999, background: kyc.wa ? colors.success : colors.borderField, position: "relative", flex: "none" }}
            >
              <span style={{ position: "absolute", top: 3, left: kyc.wa ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s" }} />
            </span>
            <span style={{ fontSize: 14 }}>Être recontactée par WhatsApp</span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={sending}
            style={{ width: "100%", height: 52, border: "none", borderRadius: 10, background: colors.accent, color: "#fff", font: `700 16px ${fonts.ui}`, cursor: sending ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            {sending && <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block", animation: "ft-spin .7s linear infinite" }} />}
            {sending ? "Envoi…" : "Envoyer ma demande"}
          </button>
        </div>

        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: 22 }}>
          <div style={{ font: `600 15px ${fonts.ui}`, marginBottom: 16 }}>Votre demande</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {cart.map((line) => (
              <div key={line.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 54, flex: "none", borderRadius: 8, background: stripe(line.colorHex) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `600 13.5px ${fonts.ui}`, lineHeight: 1.2 }}>{line.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.muted }}>× {line.qty} · {line.variant}</div>
                </div>
                <div style={{ font: `700 13.5px ${fonts.ui}`, color: colors.primary }}>{fmt(line.price * line.qty)}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: "#EAE4D9", marginBottom: 14 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: `600 14px ${fonts.ui}` }}>Total estimé</span>
            <span style={{ font: `700 20px ${fonts.ui}`, color: colors.primary }}>{money(subtotal)}</span>
          </div>
          <LoyaltyBadge points={Math.round(subtotal / 500)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", font: `600 13px ${fonts.ui}`, marginBottom: 7 }}>{label}</label>
      {children}
      {error && <p style={{ font: `500 12.5px ${fonts.ui}`, color: "#9c352d", margin: "7px 0 0" }}>{error}</p>}
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%", height: 48, padding: "0 14px",
    border: `1.5px solid ${hasError ? colors.danger : colors.borderField}`,
    borderRadius: 10, background: "#fff", font: `400 15px ${fonts.ui}`, color: colors.ink, outline: "none",
  };
}
