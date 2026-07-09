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
] as const;

export const ADMIN_PATHS = ["/boutiques"] as const;

export const ADMIN_HOST_PREFIX = "admin.";
export const PLATFORM_HOST_PREFIX = "platform.";

export interface ZoneResolution {
  zone: Zone;
  rewrittenPathname: string;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
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

  if (isLocalHost(host)) {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return { zone: "dashboard", rewrittenPathname: stripPrefix(pathname, "/admin", "/pos") };
    }
    if (pathname === "/platform" || pathname.startsWith("/platform/")) {
      return { zone: "admin", rewrittenPathname: stripPrefix(pathname, "/platform", "/boutiques") };
    }
    return { zone: "storefront", rewrittenPathname: pathname };
  }

  if (host.startsWith(ADMIN_HOST_PREFIX)) {
    return { zone: "dashboard", rewrittenPathname: pathname };
  }
  if (host.startsWith(PLATFORM_HOST_PREFIX)) {
    return { zone: "admin", rewrittenPathname: pathname };
  }
  return { zone: "storefront", rewrittenPathname: pathname };
}

export function isPathAllowedForZone(zone: Zone, pathname: string): boolean {
  const isDashboardPath = DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (zone === "dashboard") return isDashboardPath;
  if (zone === "admin") return isAdminPath;
  return !isDashboardPath && !isAdminPath;
}
