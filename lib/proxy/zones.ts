import type { Zone } from "@/lib/auth";

export const DASHBOARD_PATHS = [
  "/pos",
  "/tableau-de-bord",
  "/commandes",
  "/inventaire",
  "/clientes",
  "/marketing",
  "/finance",
  "/personnalisation",
  "/vitrine",
  "/boutique",
  "/connexion",
] as const;

export const ADMIN_PATHS = ["/boutiques"] as const;

export const ADMIN_HOST_PREFIX = "admin.";
export const PLATFORM_HOST_PREFIX = "platform.";

export interface ZoneResolution {
  zone: Zone;
  rewrittenPathname: string;
}

// En dev (localhost) ou sur les URLs Vercel sans domaine custom (*.vercel.app),
// la zone est portée par un préfixe de chemin (/admin, /platform).
// Sur un domaine custom, elle est portée par le sous-domaine (admin.*).
function usesPathRouting(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".vercel.app")
  );
}

/** @deprecated Use usesPathRouting */
function isLocalHost(hostname: string): boolean {
  return usesPathRouting(hostname);
}

function stripPrefix(pathname: string, prefix: string, fallback: string): string {
  const rest = pathname.slice(prefix.length);
  return rest === "" || rest === "/" ? fallback : rest;
}

/**
 * Résout la zone (public/privé) et le chemin interne à partir de l'hôte et
 * du chemin de la requête. En dev (localhost), la zone est portée par un
 * préfixe de chemin ; en production, par le sous-domaine. Agnostique de la
 * plateforme d'hébergement — ne dépend d'aucune API propriétaire.
 */
export function resolveZone(hostname: string, pathname: string): ZoneResolution {
  const host = hostname.split(":")[0].toLowerCase();

  if (usesPathRouting(host)) {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return { zone: "dashboard", rewrittenPathname: stripPrefix(pathname, "/admin", "/pos") };
    }
    if (pathname === "/platform" || pathname.startsWith("/platform/")) {
      return { zone: "admin", rewrittenPathname: stripPrefix(pathname, "/platform", "/boutiques") };
    }
    return { zone: "storefront", rewrittenPathname: pathname };
  }

  if (host.startsWith(ADMIN_HOST_PREFIX)) {
    // Racine du sous-domaine privé → chemin d'entrée par défaut de la zone.
    return { zone: "dashboard", rewrittenPathname: pathname === "/" ? "/pos" : pathname };
  }
  if (host.startsWith(PLATFORM_HOST_PREFIX)) {
    return { zone: "admin", rewrittenPathname: pathname === "/" ? "/boutiques" : pathname };
  }
  return { zone: "storefront", rewrittenPathname: pathname };
}

/**
 * Préfixe un chemin de la zone dashboard selon la même convention dev/prod
 * que resolveZone : /admin en dev (résolution par chemin), nu en prod
 * (résolution par sous-domaine — le chemin nu est déjà sur le bon hôte).
 * Toute redirection vers un chemin dashboard nu (ex. "/pos", "/connexion")
 * en dev retomberait en zone storefront (aucun préfixe /admin), où ce
 * chemin est interdit → redirection silencieuse vers "/", contournant la
 * garde d'auth. Utilisé par proxy.ts (NextRequest) et par les Server
 * Actions de connexion/déconnexion (lib/auth/actions.ts, qui lisent l'hôte
 * via next/headers faute d'objet NextRequest).
 */
export function dashboardPath(hostname: string, path: string): string {
  const host = hostname.split(":")[0].toLowerCase();
  return usesPathRouting(host) ? `/admin${path}` : path;
}

export function isPathAllowedForZone(zone: Zone, pathname: string): boolean {
  const isDashboardPath = DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (zone === "dashboard") return isDashboardPath;
  if (zone === "admin") return isAdminPath;
  return !isDashboardPath && !isAdminPath;
}
