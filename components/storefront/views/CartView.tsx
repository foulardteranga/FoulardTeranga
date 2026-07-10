"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { fonts, colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { stripe } from "@/lib/theme/storefront";
import { useStorefront } from "@/lib/store/useStorefront";
import { cartSubtotal, cartCount } from "@/lib/store/cartLogic";
import { money, fmt } from "@/lib/format";

export function CartView() {
  const router = useRouter();
  const cart = useStorefront((s) => s.cart);
  const incLine = useStorefront((s) => s.incLine);
  const rmLine = useStorefront((s) => s.rmLine);
  const offline = useStorefront((s) => s.offline);
  const showToast = useStorefront((s) => s.showToast);

  const subtotal = cartSubtotal(cart);
  const count = cartCount(cart);

  const goCheckout = () => {
    if (cart.length === 0) { showToast("Panier vide", "warning"); return; }
    router.push("/commander");
  };

  return (
    <div className="ft-store-page" style={{ maxWidth: 920, margin: "0 auto" }}>
      <h1 className="ft-store-h1" style={{ fontFamily: fonts.display, fontWeight: 600, margin: "0 0 20px", letterSpacing: "-.01em" }}>
        Mon panier
      </h1>

      {cart.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 16, padding: "64px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "#F4F0E9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Icon path={ICONS.cart} size={30} stroke="#B6AEA1" strokeWidth={1.6} />
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22, marginBottom: 6 }}>Votre panier est vide</div>
          <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 22px", maxWidth: 320 }}>
            Découvrez nos nouveautés et ajoutez vos coups de cœur.
          </p>
          <Link href="/catalogue" style={{ height: 48, padding: "0 26px", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 15px ${fonts.ui}`, display: "inline-flex", alignItems: "center" }}>
            Voir la boutique
          </Link>
        </div>
      ) : (
        <>
          {offline && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: "#F4EFE7", border: "1px solid #E7DECF", borderRadius: 10, fontSize: 13, color: colors.muted, marginBottom: 16 }}>
              <Icon path={ICONS.wifiOff} size={16} stroke="#8a6a3a" strokeWidth={1.8} />
              Panier enregistré hors-ligne. Vous pourrez l&apos;envoyer au retour du réseau.
            </div>
          )}
          <div className="ft-store-cart-layout" style={{ display: "grid", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cart.map((line) => (
                <div key={line.key} style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 74, height: 90, flex: "none", borderRadius: 10, background: stripe(line.colorHex) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 16 }}>{line.name}</div>
                    <div style={{ fontSize: 12.5, color: colors.muted, margin: "3px 0 10px" }}>{line.variant}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", height: 38, border: `1.5px solid ${colors.borderField}`, borderRadius: 8, overflow: "hidden" }}>
                      <button onClick={() => incLine(line.key, -1)} style={{ width: 38, height: "100%", border: "none", background: colors.ivory, fontSize: 17, color: colors.primary, cursor: "pointer" }}>−</button>
                      <span style={{ width: 42, textAlign: "center", font: `600 14px ${fonts.ui}` }}>{line.qty}</span>
                      <button onClick={() => incLine(line.key, 1)} style={{ width: 38, height: "100%", border: "none", background: colors.ivory, fontSize: 17, color: colors.primary, cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ font: `700 16px ${fonts.ui}`, color: colors.primary }}>{fmt(line.price * line.qty)}</div>
                    <div style={{ fontSize: 11, color: "#9a8f7d" }}>FCFA</div>
                    <button onClick={() => rmLine(line.key)} style={{ border: "none", background: "none", color: colors.danger, font: `500 12px ${fonts.ui}`, cursor: "pointer", marginTop: 8 }}>
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, padding: 22 }}>
              <div style={{ font: `600 16px ${fonts.ui}`, marginBottom: 16 }}>Récapitulatif</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.muted, marginBottom: 10 }}>
                <span>Sous-total ({count} art.)</span>
                <span style={{ color: colors.ink, fontWeight: 600 }}>{money(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.muted, marginBottom: 16 }}>
                <span>Livraison</span>
                <span>À convenir</span>
              </div>
              <div style={{ height: 1, background: "#EAE4D9", marginBottom: 16 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <span style={{ font: `600 15px ${fonts.ui}` }}>Total estimé</span>
                <span style={{ font: `700 22px ${fonts.ui}`, color: colors.primary }}>{money(subtotal)}</span>
              </div>
              <button onClick={goCheckout} style={{ width: "100%", height: 50, border: "none", borderRadius: 10, background: colors.accent, color: "#fff", font: `700 15px ${fonts.ui}`, cursor: "pointer" }}>
                Valider le panier
              </button>
              <Link href="/catalogue" style={{ width: "100%", height: 46, marginTop: 10, border: `1.5px solid ${colors.primary}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                Continuer mes achats
              </Link>
              <p style={{ fontSize: 12.5, color: colors.muted, margin: "14px 0 0", lineHeight: 1.5, textAlign: "center" }}>
                Sans paiement en ligne. La gérante vous recontacte pour confirmer.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
