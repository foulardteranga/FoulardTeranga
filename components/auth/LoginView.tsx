"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";

export function LoginView() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/pos";
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: colors.ivory,
        fontFamily: fonts.ui,
      }}
    >
      {/* Panneau de Gauche : Immersion Marque (Desktop >= 900px) */}
      <style>{`
        @media (max-width: 899px) {
          .login-brand-panel { display: none !important; }
          .login-main-panel { width: 100% !important; padding: 24px 16px !important; }
        }
      `}</style>
      <div
        className="login-brand-panel"
        style={{
          flex: 1,
          background: `linear-gradient(135deg, ${colors.primary} 0%, #171f45 100%)`,
          color: "#fff",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Lueur d'accentuation en fond */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "360px",
            height: "360px",
            background: colors.accent,
            borderRadius: "50%",
            filter: "blur(120px)",
            opacity: 0.25,
            pointerEvents: "none",
          }}
        />

        {/* Logo & Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: colors.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 20,
              fontFamily: fonts.display,
              color: "#fff",
            }}
          >
            T
          </div>
          <span style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Foulard Teranga
          </span>
        </div>

        {/* Contenu Éditorial */}
        <div style={{ maxWidth: 440, zIndex: 1 }}>
          <h2
            style={{
              fontFamily: fonts.display,
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            Plateforme de Gestion Omnicanale
          </h2>
          <p style={{ fontSize: 15, color: "#D3CCE3", lineHeight: 1.6, marginBottom: 36 }}>
            Foulards africains et accessoires élégants pour la femme moderne. Gérez vos ventes en caisse, vos stocks et vos clientes en un seul endroit.
          </p>

          {/* Atouts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon path={ICONS.cart} size={18} stroke="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Point de vente & Ventes au comptoir (POS)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon path={ICONS.inv} size={18} stroke="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Gestion d'inventaire & suivi des stocks</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon path={ICONS.star} size={18} stroke={colors.gold} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Programme de fidélité & réductions clientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau de Droite : Formulaire */}
      <div
        className="login-main-panel"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div
            style={{
              background: "#fff",
              padding: 36,
              borderRadius: 16,
              boxShadow: "0 8px 24px rgba(60,40,20,0.08)",
              border: `1px solid ${colors.sable}`,
            }}
          >
            <h1
              style={{
                fontFamily: fonts.display,
                fontSize: 26,
                fontWeight: 600,
                color: colors.ink,
                marginBottom: 6,
              }}
            >
              Espace Back-Office
            </h1>
            <p style={{ fontSize: 14, color: colors.muted, marginBottom: 24 }}>
              Saisissez vos identifiants pour accéder à votre espace de gestion.
            </p>

            <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <input type="hidden" name="next" value={next} />

              {/* Champ Email */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: colors.ink }}>
                Email
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Icon
                    path={ICONS.mail}
                    size={18}
                    stroke={colors.muted}
                    style={{ position: "absolute", left: 14, pointerEvents: "none" }}
                  />
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="exemple@foulardteranga.com"
                    style={{
                      width: "100%",
                      padding: "11px 14px 11px 42px",
                      borderRadius: 10,
                      border: `1.5px solid ${colors.borderField}`,
                      fontSize: 14,
                      outline: "none",
                      color: colors.ink,
                      background: "#fff",
                    }}
                  />
                </div>
                {state && !state.ok && state.errors.email && (
                  <span style={{ color: colors.danger, fontSize: 12, fontWeight: 500 }}>{state.errors.email}</span>
                )}
              </label>

              {/* Champ Mot de passe */}
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: colors.ink }}>
                Mot de passe
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Icon
                    path={ICONS.user}
                    size={18}
                    stroke={colors.muted}
                    style={{ position: "absolute", left: 14, pointerEvents: "none" }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      padding: "11px 44px 11px 42px",
                      borderRadius: 10,
                      border: `1.5px solid ${colors.borderField}`,
                      fontSize: 14,
                      outline: "none",
                      color: colors.ink,
                      background: "#fff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: "absolute",
                      right: 12,
                      background: "none",
                      border: "none",
                      padding: 4,
                      cursor: "pointer",
                      color: colors.muted,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    <Icon path={showPassword ? ICONS.eyeOff : ICONS.eye} size={18} stroke={colors.muted} />
                  </button>
                </div>
                {state && !state.ok && state.errors.password && (
                  <span style={{ color: colors.danger, fontSize: 12, fontWeight: 500 }}>{state.errors.password}</span>
                )}
              </label>

              {/* Erreur de formulaire globale */}
              {state && !state.ok && state.formError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: colors.bgDanger,
                    border: `1px solid ${colors.danger}`,
                    color: colors.fgDanger,
                    fontSize: 13,
                  }}
                >
                  <Icon path={ICONS.alertTriangle} size={18} stroke={colors.danger} style={{ flexShrink: 0 }} />
                  <span>{state.formError}</span>
                </div>
              )}

              {/* Bouton de Soumission */}
              <button
                type="submit"
                disabled={pending}
                style={{
                  height: 48,
                  borderRadius: 10,
                  border: "none",
                  background: colors.primary,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: pending ? "default" : "pointer",
                  opacity: pending ? 0.85 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginTop: 6,
                  transition: "background 0.2s",
                }}
              >
                {pending ? (
                  <>
                    <svg
                      style={{ width: 18, height: 18, animation: "spin 0.8s linear infinite" }}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                      <path d="M12 2 a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span>Connexion en cours…</span>
                  </>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
