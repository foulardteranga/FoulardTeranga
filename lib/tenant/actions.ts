"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant, TENANTS_CACHE_TAG } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { requireWritableSession, READ_ONLY_ERROR } from "@/lib/impersonation/guards";
import { themeSchema, type ThemeInput } from "@/lib/validators/theme";

export async function updateTenantTheme(
  input: ThemeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (session?.role !== "owner") {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
  if (!(await requireWritableSession())) {
    return { ok: false, error: READ_ONLY_ERROR };
  }

  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Informations invalides." };
  }

  const tenant = await getCurrentTenant();
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: parsed.data.shopName,
      tagline: parsed.data.tagline,
      primaryColor: parsed.data.primary,
      accentColor: parsed.data.accent,
      font: parsed.data.font,
      whatsappPhone: parsed.data.phone || null,
    },
  });

  revalidatePath("/admin/personnalisation");
  revalidatePath("/");
  // updateTag (et non revalidateTag) : cette Server Action doit invalider
  // immédiatement l'entrée de cache du parc (lecture de sa propre écriture),
  // pas seulement la marquer stale pour une revalidation en arrière-plan.
  updateTag(TENANTS_CACHE_TAG);
  return { ok: true };
}
