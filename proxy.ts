import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveZone,
  isPathAllowedForZone,
  dashboardPath,
  platformPath,
  moduleForPath,
  MODULE_ID_PATHS,
} from "@/lib/proxy/zones";
import { isRoleAllowedForZone, hasModuleAccess } from "@/lib/auth";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { resolveRequestIdentity } from "@/lib/impersonation/context";
import { IMPERSONATION_COOKIE_NAME } from "@/lib/impersonation/cookie";

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "localhost";
  const { zone, rewrittenPathname } = resolveZone(hostname, request.nextUrl.pathname);

  if (!isPathAllowedForZone(zone, rewrittenPathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Réponse "brouillon" utilisée par le client Supabase pour écrire les cookies
  // de rafraîchissement de session ; recopiée sur la réponse finale plus bas,
  // qu'il s'agisse d'une redirection ou d'un rewrite.
  const authDraft = NextResponse.next();

  if (zone !== "storefront" && rewrittenPathname !== "/connexion") {
    const supabase = createMiddlewareClient(request, authDraft);
    const impersonationCookieRaw = request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;
    const identity = await resolveRequestIdentity(supabase, impersonationCookieRaw);
    // Zone plateforme : gardée sur l'acteur RÉEL, pour que le prestataire reste
    // maître de sa propre zone même en cours d'impersonation (sinon "Quitter"
    // deviendrait inatteignable). Zone dashboard : gardée sur l'identité
    // EFFECTIVE, qui est celle de la cible en impersonation.
    const roleForZone = zone === "admin" ? (identity?.actor.role ?? null) : (identity?.session.role ?? null);
    const session = identity?.session ?? null;

    if (!isRoleAllowedForZone(zone, roleForZone)) {
      // Chaque zone privée a désormais sa propre page de connexion : le
      // prestataire refusé sur /boutiques atterrit sur la connexion plateforme,
      // pas sur la vitrine. Pas de boucle possible : /connexion sort de ce bloc
      // (condition d'entrée plus haut).
      const target =
        zone === "dashboard"
          ? dashboardPath(hostname, "/connexion")
          : platformPath(hostname, "/connexion");
      const redirectUrl = new URL(target, request.url);
      redirectUrl.searchParams.set("next", rewrittenPathname);
      const redirect = NextResponse.redirect(redirectUrl);
      authDraft.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    // Contrôle d'accès par module (profils d'accès personnalisés, cf. design
    // 2026-07-22). "/equipe" a sa propre garde : owner uniquement, jamais un
    // module coché dans un EmployeeRole (escalade de privilèges).
    if (zone === "dashboard") {
      const isEquipePath = rewrittenPathname === "/equipe" || rewrittenPathname.startsWith("/equipe/");
      const moduleId = moduleForPath(rewrittenPathname);
      const moduleAllowed = isEquipePath
        ? session?.role === "owner"
        : moduleId
          ? hasModuleAccess(session, moduleId)
          : true;

      if (!moduleAllowed) {
        // Repli sur le premier module autorisé du profil. Peut être vide (ex.
        // compte staff sans EmployeeRole assigné, cf. le test "defaults staff
        // permissions to an empty array..." dans lib/auth/index.test.ts) — dans
        // ce cas, repli sur /connexion, qui sort de ce bloc de contrôle et ne
        // peut donc pas reboucler.
        const firstAllowedId = Object.keys(MODULE_ID_PATHS).find((id) => hasModuleAccess(session, id));
        const fallbackPath = firstAllowedId ? MODULE_ID_PATHS[firstAllowedId] : undefined;
        const redirectUrl = new URL(dashboardPath(hostname, fallbackPath ?? "/connexion"), request.url);
        const redirect = NextResponse.redirect(redirectUrl);
        authDraft.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    }
  }

  // La résolution du tenant est faite côté serveur applicatif (lib/tenant), où
  // elle est mise en cache : la garder ici imposerait un aller-retour SQL sur
  // chaque requête de vitrine publique.
  //
  // Le STATUT de la boutique (suspendue/archivée, spec §9) n'est volontairement
  // pas contrôlé ici non plus — décision revalidée en phase 4, pas héritée. La
  // requête Prisma que ce fichier exécute depuis la phase 3 ne part que si un
  // cookie d'impersonation est présent ET que l'acteur est super_admin, donc
  // quasiment jamais ; contrôler le statut ici la rendrait inconditionnelle sur
  // le chemin public, celui où CLAUDE.md §10 vise un LCP < 2,5 s. L'application
  // vit dans les layouts (spec §2), qui lisent le registry en cache :
  //   - app/(storefront)/layout.tsx        → indisponible (suspendue) / 404 (archivée)
  //   - app/(dashboard)/layout.tsx         → écran bloquant
  //   - app/(auth)/connexion/page.tsx      → message, zone dashboard uniquement
  //   - lib/auth/actions.ts (signIn)       → refus côté action
  // Ce choix est couvert par les tests « statut de boutique » de proxy.test.ts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-host", hostname);
  // La zone résolue est publiée pour les Server Components : `/connexion` est un
  // chemin partagé par la zone dashboard et la zone plateforme (Next.js interdit
  // deux `page.tsx` sur le même chemin), et seule cette information permet à la
  // page de savoir laquelle des deux elle sert.
  requestHeaders.set("x-zone", zone);

  const url = request.nextUrl.clone();
  url.pathname = rewrittenPathname;

  const rewrite = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  authDraft.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
  return rewrite;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
