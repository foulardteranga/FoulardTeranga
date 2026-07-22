import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveZone, isPathAllowedForZone, dashboardPath } from "@/lib/proxy/zones";
import { resolveTenantFromHost } from "@/lib/tenant/registry";
import { resolveSession, isRoleAllowedForZone } from "@/lib/auth";
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
  }

  const tenant = resolveTenantFromHost(hostname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);

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
