import { headers } from "next/headers";
import { DEFAULT_TENANT, TENANTS } from "./registry";
import type { Tenant } from "./types";

export type { Tenant, ThemeTokens } from "./types";
export { DEFAULT_TENANT, TENANTS, resolveTenantFromHost } from "./registry";

/** Lit le tenant résolu par `proxy.ts` (en-tête `x-tenant-id`) depuis un Server Component. */
export async function getCurrentTenant(): Promise<Tenant> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return DEFAULT_TENANT;
  return TENANTS.find((t) => t.id === tenantId) ?? DEFAULT_TENANT;
}
