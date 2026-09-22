"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { customColorSchema, type CustomColorInput } from "@/lib/validators/colors";

export interface TenantColorItem {
  id: string;
  name: string;
  hex: string;
  family: string | null;
  isFavorite: boolean;
}

/**
 * Récupère les couleurs personnalisées et favorites de la boutique.
 */
export async function getTenantColors(): Promise<TenantColorItem[]> {
  try {
    const tenant = await getCurrentTenant();
    const rows = await prisma.tenantCustomColor.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hex: r.hex,
      family: r.family,
      isFavorite: r.isFavorite,
    }));
  } catch {
    return [];
  }
}

/**
 * Enregistre une nouvelle couleur personnalisée pour la boutique.
 */
export async function saveCustomColor(
  input: CustomColorInput
): Promise<{ ok: true; color: TenantColorItem } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Non autorisé." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = customColorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Couleur invalide." };
  }

  try {
    const tenant = await getCurrentTenant();
    const existing = await prisma.tenantCustomColor.findFirst({
      where: {
        tenantId: tenant.id,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
    });

    if (existing) {
      // Mettre à jour si elle existe déjà
      const updated = await prisma.tenantCustomColor.update({
        where: { id: existing.id },
        data: {
          hex: parsed.data.hex,
          family: parsed.data.family ?? existing.family,
          isFavorite: parsed.data.isFavorite,
        },
      });
      revalidatePath("/admin/inventaire");
      return { ok: true, color: updated };
    }

    const created = await prisma.tenantCustomColor.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        hex: parsed.data.hex,
        family: parsed.data.family ?? null,
        isFavorite: parsed.data.isFavorite,
      },
    });

    revalidatePath("/admin/inventaire");
    return { ok: true, color: created };
  } catch {
    return { ok: false, error: "Impossible d'enregistrer la couleur personnalisée." };
  }
}

/**
 * Bascule le statut favori d'une couleur personnalisée.
 */
export async function toggleFavoriteColor(
  colorId: string
): Promise<{ ok: true; isFavorite: boolean } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Non autorisé." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    const color = await prisma.tenantCustomColor.findFirst({
      where: { id: colorId, tenantId: tenant.id },
    });
    if (!color) return { ok: false, error: "Couleur introuvable." };

    const updated = await prisma.tenantCustomColor.update({
      where: { id: color.id },
      data: { isFavorite: !color.isFavorite },
    });

    revalidatePath("/admin/inventaire");
    return { ok: true, isFavorite: updated.isFavorite };
  } catch {
    return { ok: false, error: "Erreur lors de la mise à jour." };
  }
}
