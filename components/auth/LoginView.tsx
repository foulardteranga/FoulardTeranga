"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signInPlatform, type SignInState } from "@/lib/auth/actions";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";

export function LoginView({ variant = "dashboard" }: { variant?: "dashboard" | "platform" }) {
  const isPlatform = variant === "platform";
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? (isPlatform ? "/boutiques" : "/pos");
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    isPlatform ? signInPlatform : signIn,
    null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: colors.ivory,
        fontFamily: fonts.ui,
        color: colors.ink,
      }}
    >
      {/* Styles globaux pour la réactivité, animations et états de focus fluides */}
      <style>{`
        @keyframes loginFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.08); opacity: 0.35; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-card-input-wrapper {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }
        .login-btn-primary {
          transition: transform 0.15s ease, background-color 0.2s ease, box-shadow 0.2s ease;
        }
        .login-btn-primary:hover:not(:disabled) {
          background-color: ${colors.primaryHover} !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(38, 50, 107, 0.25);
        }
        .login-btn-primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 6px rgba(38, 50, 107, 0.2);
        }
        .login-toggle-eye {
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        .login-toggle-eye:hover {
          background-color: rgba(38, 50, 107, 0.08) !important;
          color: ${colors.primary} !important;
        }
        @media (max-width: 899px) {
          .login-brand-panel { display: none !important; }
          .login-main-panel { width: 100% !important; padding: 32px 20px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-brand-panel video,
          .login-glow-effect,
          .login-card-anim { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Panneau de Gauche : Immersion Marque (Desktop >= 900px) */}
      <div
        className="login-brand-panel"
        style={{
          flex: 1,
          background: `linear-gradient(135deg, ${colors.primary} 0%, #13193a 100%)`,
          color: "#fff",
          padding: "56px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Vidéo d'arrière-plan avec fallback dégradé */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        >
          <source src="/videos/login-bg.mp4" type="video/mp4" />
        </video>

        {/* Masque de superposition Indigo riche */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, rgba(38, 50, 107, 0.88) 0%, rgba(19, 25, 58, 0.94) 100%)`,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Lueur d'accentuation dynamique */}
        <div
          className="login-glow-effect"
          style={{
            position: "absolute",
            top: "-15%",
            right: "-15%",
            width: "420px",
            height: "420px",
            background: colors.accent,
            borderRadius: "50%",
            filter: "blur(140px)",
            opacity: 0.28,
            animation: "pulseGlow 8s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Logo & Header de Marque */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, zIndex: 2 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentHover} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 22,
              fontFamily: fonts.display,
              color: "#fff",
              boxShadow: "0 4px 12px rgba(208, 122, 52, 0.35)",
            }}
          >
            T
          </div>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#fff",
            }}
          >
            {isPlatform ? "Console plateforme" : "Foulard Teranga"}
          </span>
        </div>

        {/* Contenu Éditorial & Atouts Glassmorphism */}
        <div style={{ maxWidth: 460, zIndex: 2, margin: "auto 0" }}>
          <h2
            style={{
              fontFamily: fonts.display,
              fontSize: 34,
              fontWeight: 600,
              lineHeight: 1.22,
              marginBottom: 16,
              letterSpacing: "-0.015em",
              color: "#ffffff",
            }}
          >
            Plateforme de Gestion Omnicanale
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "#D4CEE8",
              lineHeight: 1.65,
              marginBottom: 36,
              fontWeight: 400,
            }}
          >
            Foulards africains et accessoires élégants pour la femme moderne. Digitalisez vos ventes en caisse, vos stocks et votre relation cliente.
          </p>

          {/* Cartes d'atouts avec effet de verre (Glassmorphism) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 18px",
                borderRadius: 14,
                background: "rgba(255, 255, 255, 0.07)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                transition: "transform 0.2s ease, background-color 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon path={ICONS.cart} size={20} stroke="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>
                Point de vente & Ventes au comptoir (POS)
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 18px",
                borderRadius: 14,
                background: "rgba(255, 255, 255, 0.07)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon path={ICONS.inv} size={20} stroke="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>
                Gestion d'inventaire & suivi des stocks
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 18px",
                borderRadius: 14,
                background: "rgba(255, 255, 255, 0.07)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "rgba(255, 255, 255, 0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon path={ICONS.star} size={20} stroke={colors.gold} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>
                Programme de fidélité & réductions clientes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau de Droite : Formulaire d'accès */}
      <div
        className="login-main-panel"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "56px 40px",
        }}
      >
        <div
          className="login-card-anim"
          style={{
            width: "100%",
            maxWidth: 420,
            animation: "loginFadeIn 0.35s ease-out",
          }}
        >
          {/* Badge & Logo Mobile */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
            className="md:hidden"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: colors.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 18,
                fontFamily: fonts.display,
                color: "#fff",
              }}
            >
              T
            </div>
            <span style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 600, color: colors.ink }}>
              {isPlatform ? "Console plateforme" : "Foulard Teranga"}
            </span>
          </div>

          {/* Carte Principale de Connexion */}
          <div
            style={{
              background: colors.surface,
              padding: "40px 36px",
              borderRadius: 20,
              boxShadow: "0 20px 40px -15px rgba(38, 50, 107, 0.07), 0 1px 3px rgba(30, 27, 24, 0.04)",
              border: `1px solid ${colors.borderSoft}`,
            }}
          >
            <div style={{ marginBottom: 28 }}>
              <h1
                style={{
                  fontFamily: fonts.display,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                {isPlatform ? "Espace Plateforme" : "Espace Back-Office"}
              </h1>
              <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.5, margin: 0 }}>
                {isPlatform
                  ? "Console prestataire : administration du parc de boutiques."
                  : "Saisissez vos identifiants pour accéder à votre espace de gestion."}
              </p>
            </div>

            <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <input type="hidden" name="next" value={next} />

              {/* Champ Email */}
              <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: colors.ink }}>
                Adresse e-mail
                <div
                  className="login-card-input-wrapper"
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 12,
                    border: `1.5px solid ${focusedField === "email" ? colors.primary : colors.borderField}`,
                    boxShadow: focusedField === "email" ? "0 0 0 3px rgba(38, 50, 107, 0.14)" : "none",
                    background: "#fff",
                  }}
                >
                  <Icon
                    path={ICONS.mail}
                    size={18}
                    stroke={focusedField === "email" ? colors.primary : colors.muted}
                    style={{ position: "absolute", left: 14, pointerEvents: "none", transition: "stroke 0.2s ease" }}
                  />
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="gérante@foulardteranga.com"
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      width: "100%",
                      padding: "12px 14px 12px 42px",
                      borderRadius: 12,
                      border: "none",
                      fontSize: 14,
                      outline: "none",
                      color: colors.ink,
                      background: "transparent",
                    }}
                  />
                </div>
                {state && !state.ok && state.errors.email && (
                  <span style={{ color: colors.danger, fontSize: 12, fontWeight: 500, marginTop: 2 }}>
                    {state.errors.email}
                  </span>
                )}
              </label>

              {/* Champ Mot de passe */}
              <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13, fontWeight: 600, color: colors.ink }}>
                Mot de passe
                <div
                  className="login-card-input-wrapper"
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 12,
                    border: `1.5px solid ${focusedField === "password" ? colors.primary : colors.borderField}`,
                    boxShadow: focusedField === "password" ? "0 0 0 3px rgba(38, 50, 107, 0.14)" : "none",
                    background: "#fff",
                  }}
                >
                  <Icon
                    path={ICONS.user}
                    size={18}
                    stroke={focusedField === "password" ? colors.primary : colors.muted}
                    style={{ position: "absolute", left: 14, pointerEvents: "none", transition: "stroke 0.2s ease" }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      width: "100%",
                      padding: "12px 44px 12px 42px",
                      borderRadius: 12,
                      border: "none",
                      fontSize: 14,
                      outline: "none",
                      color: colors.ink,
                      background: "transparent",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="login-toggle-eye"
                    style={{
                      position: "absolute",
                      right: 10,
                      background: "none",
                      border: "none",
                      padding: 6,
                      borderRadius: 8,
                      cursor: "pointer",
                      color: colors.muted,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    <Icon path={showPassword ? ICONS.eyeOff : ICONS.eye} size={18} stroke="currentColor" />
                  </button>
                </div>
                {state && !state.ok && state.errors.password && (
                  <span style={{ color: colors.danger, fontSize: 12, fontWeight: 500, marginTop: 2 }}>
                    {state.errors.password}
                  </span>
                )}
              </label>

              {/* Message d'Erreur Globale */}
              {state && !state.ok && state.formError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: colors.bgDanger,
                    border: `1px solid ${colors.danger}`,
                    color: colors.fgDanger,
                    fontSize: 13,
                    fontWeight: 500,
                    animation: "loginFadeIn 0.2s ease",
                  }}
                >
                  <Icon path={ICONS.alertTriangle} size={18} stroke={colors.danger} style={{ flexShrink: 0 }} />
                  <span>{state.formError}</span>
                </div>
              )}

              {/* Bouton de Soumission Principal */}
              <button
                type="submit"
                disabled={pending}
                className="login-btn-primary"
                style={{
                  height: 50,
                  borderRadius: 12,
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
