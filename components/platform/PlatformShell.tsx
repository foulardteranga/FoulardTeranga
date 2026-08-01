import Link from "next/link";
import { colors, fonts, adminBorder, hexA } from "@/lib/theme/tokens";
import { signOutPlatform } from "@/lib/auth/actions";

/**
 * Couche visuelle partagée par tous les écrans de la zone plateforme : focus
 * clavier visible (DESIGN.md §18, anneau indigo) et retours de survol,
 * absents des styles inline d'origine. Émise une seule fois ici — le shell
 * enveloppe déjà tous les écrans — plutôt que dupliquée par composant.
 * `!important` est nécessaire : ces règles retouchent des styles posés en
 * inline, plus spécifiques qu'une feuille de style ordinaire.
 */
const FOCUS_RING = `outline: 3px solid ${hexA(colors.primary, 0.35)} !important; outline-offset: 2px !important;`;

function PlatformFocusStyles() {
  return (
    <style>{`
      .ft-platform-link:hover { color: ${colors.primary} !important; text-decoration: underline !important; }
      .ft-platform-link:focus-visible,
      .ft-platform-btn:focus-visible,
      .ft-platform-tab:focus-visible,
      .ft-platform-tab-inert:focus-visible,
      .ft-platform-input:focus-visible,
      .ft-platform-select:focus-visible,
      .ft-platform-textarea:focus-visible,
      .ft-platform-checkbox:focus-visible,
      .ft-platform-radio:focus-visible,
      .ft-platform-card-link:focus-visible { ${FOCUS_RING} }

      .ft-platform-btn-primary:hover:not(:disabled) { background: ${colors.primaryHover} !important; }
      .ft-platform-btn-ghost:hover:not(:disabled) { background: ${colors.faintLine} !important; }
      /* Onglet courant exclu : sinon le survol lui fait perdre sa couleur active
         tout en gardant son soulignement, un état visuellement incohérent. */
      .ft-platform-tab:hover:not(.ft-platform-tab-current) { color: ${colors.ink} !important; }
      .ft-platform-card-link:hover { border-color: ${colors.borderField} !important; }

      .ft-platform-input:focus-visible,
      .ft-platform-select:focus-visible,
      .ft-platform-textarea:focus-visible { border-color: ${colors.primary} !important; }

      @keyframes ft-spin { to { transform: rotate(360deg); } }
      .ft-spin { animation: ft-spin .7s linear infinite; }
    `}</style>
  );
}

export function PlatformShell({
  userName,
  children,
  basePath = "",
}: {
  userName: string;
  children: React.ReactNode;
  basePath?: string;
}) {
  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, color: colors.ink, fontFamily: fonts.ui }}>
      <PlatformFocusStyles />
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 24px",
          background: colors.surface,
          borderBottom: adminBorder,
        }}
      >
        <Link
          href={`${basePath}/boutiques`}
          className="ft-platform-link"
          style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 600, color: colors.ink, textDecoration: "none" }}
        >
          Console plateforme
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href={`${basePath}/boutiques`} className="ft-platform-link" style={{ fontSize: 14, color: colors.muted, textDecoration: "none" }}>
            Boutiques
          </Link>
          <span style={{ fontSize: 13, color: colors.muted }}>{userName}</span>
          <form action={signOutPlatform}>
            <button
              type="submit"
              className="ft-platform-btn ft-platform-btn-ghost"
              style={{
                border: `1px solid ${colors.borderField}`,
                background: "transparent",
                borderRadius: 10,
                padding: "7px 14px",
                fontSize: 13,
                color: colors.ink,
                cursor: "pointer",
              }}
            >
              Se déconnecter
            </button>
          </form>
        </nav>
      </header>

      <main style={{ padding: "28px 24px 56px", maxWidth: 1180, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
