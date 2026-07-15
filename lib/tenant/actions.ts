"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { themeSchema, type ThemeInput } from "@/lib/validators/theme";

export async function updateTenantTheme(
  input: ThemeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (session?.role !== "owner") {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
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
  return { ok: true };
}
