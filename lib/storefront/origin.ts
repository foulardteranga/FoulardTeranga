import { ADMIN_HOST_PREFIX } from "@/lib/proxy/zones";

/**
 * Origine du site public, même appelé depuis le back-office (hôte `admin.`
 * en production, préfixe de chemin `/admin` en dev sur le même hôte — voir
 * `lib/proxy/zones.ts`). Client uniquement : dépend de `window.location`.
 */
export function storefrontOrigin(): string {
  if (typeof window === "undefined") return "";
  const { protocol, host } = window.location;
  const bareHost = host.startsWith(ADMIN_HOST_PREFIX) ? host.slice(ADMIN_HOST_PREFIX.length) : host;
  return `${protocol}//${bareHost}`;
}
