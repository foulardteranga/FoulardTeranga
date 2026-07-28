import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { signOutPlatform } from "@/lib/auth/actions";

export function PlatformShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, color: colors.ink, fontFamily: fonts.ui }}>
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
          href="/boutiques"
          style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 600, color: colors.ink, textDecoration: "none" }}
        >
          Console plateforme
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/boutiques" style={{ fontSize: 14, color: colors.muted, textDecoration: "none" }}>
            Boutiques
          </Link>
          <span style={{ fontSize: 13, color: colors.muted }}>{userName}</span>
          <form action={signOutPlatform}>
            <button
              type="submit"
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
