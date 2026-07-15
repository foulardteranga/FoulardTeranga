import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";

export interface TenantSettings {
  shopName: string;
  tagline: string;
  primary: string;
  accent: string;
  font: "Playfair Display" | "Inter";
  phone: string;
}

/** Lit les réglages de personnalisation persistés de la boutique courante. */
export async function getTenantSettings(): Promise<TenantSettings> {
  const tenant = await getCurrentTenant();
  const row = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
  return {
    shopName: row.name,
    tagline: row.tagline,
    primary: row.primaryColor,
    accent: row.accentColor,
    font: row.font === "Inter" ? "Inter" : "Playfair Display",
    phone: row.whatsappPhone ?? "",
  };
}
