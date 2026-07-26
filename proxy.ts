import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveZone,
  isPathAllowedForZone,
  dashboardPath,
  moduleForPath,
  MODULE_ID_PATHS,
} from "@/lib/proxy/zones";
import { resolveSession, isRoleAllowedForZone, hasModuleAccess } from "@/lib/auth";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

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
    const session = await resolveSession(supabase);
    if (!isRoleAllowedForZone(zone, session?.role ?? null)) {
      // La zone admin (super_admin) n'a pas de page de connexion dédiée dans ce
      // sous-projet (dormant en v1, aucun compte super_admin) — comportement
      // inchangé : redirection vers la vitrine.
      const target = zone === "dashboard" ? dashboardPath(hostname, "/connexion") : "/";
      const redirectUrl = new URL(target, request.url);
      if (zone === "dashboard") redirectUrl.searchParams.set("next", rewrittenPathname);
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

  // La résolution du tenant est faite côté serveur applicatif (lib/tenant),
  // où elle est mise en cache : la garder ici imposerait un aller-retour SQL
  // sur chaque requête de vitrine publique.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-host", hostname);

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
