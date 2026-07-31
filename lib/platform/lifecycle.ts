"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { TENANTS_CACHE_TAG } from "@/lib/tenant";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";
import { transitionRefusal, type LifecycleTarget } from "./transitions";
import { suspendTenantSchema, type SuspendTenantInput } from "@/lib/validators/platform";
import type { PlatformAction, TenantStatus } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

export type PlatformResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";
const NOT_FOUND_ERROR = "Boutique introuvable.";

/**
 * Corps commun des trois transitions d'état. Chacune ne diffère que par sa
 * cible, les colonnes qu'elle écrit et son action d'audit — factoriser évite
 * que l'une d'elles oublie `updateTag` (sans quoi la vitrine d'une boutique
 * suspendue reste servie jusqu'à 5 minutes, plancher `revalidate` du registry).
 */
async function applyTransition(
  tenantId: string,
  target: Exclude<LifecycleTarget, "deleted">,
  action: PlatformAction,
  data: Prisma.TenantUpdateInput,
  metadata: Record<string, unknown>
): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  let slug = "";
  try {
    const before = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, status: true },
    });
    if (!before) return { ok: false, error: NOT_FOUND_ERROR };
    slug = before.slug;

    const refusal = transitionRefusal(before.status as TenantStatus, target);
    if (refusal) return { ok: false, error: refusal };

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: tenantId }, data });
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action,
          tenantId,
          metadata: { slug: before.slug, name: before.name, statusBefore: before.status, ...metadata },
        },
        tx
      );
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Hors du try : un échec ici correspond à une écriture déjà réussie.
  updateTag(TENANTS_CACHE_TAG);
  revalidatePath("/boutiques");
  revalidatePath(`/boutiques/${slug}`);
  return { ok: true };
}

/** `active`/`suspended` → `suspended` (spec §9). Vitrine indisponible, back-office bloqué, données intactes. */
export async function suspendTenant(tenantId: string, input: SuspendTenantInput): Promise<PlatformResult> {
  const parsed = suspendTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const reason = parsed.data.reason;
  return applyTransition(
    tenantId,
    "suspended",
    "tenant_suspended",
    { status: "suspended", suspendedAt: new Date(), suspendedReason: reason || null },
    { reason }
  );
}

/** `suspended`/`archived` → `active` (spec §9). Efface les trois marqueurs de sortie. */
export async function reactivateTenant(tenantId: string): Promise<PlatformResult> {
  return applyTransition(
    tenantId,
    "active",
    "tenant_reactivated",
    { status: "active", suspendedAt: null, suspendedReason: null, archivedAt: null },
    {}
  );
}

/** `active`/`suspended` → `archived` (spec §9). Sortie du parc, invisible sauf pour le prestataire. */
export async function archiveTenant(tenantId: string): Promise<PlatformResult> {
  return applyTransition(
    tenantId,
    "archived",
    "tenant_archived",
    { status: "archived", archivedAt: new Date() },
    {}
  );
}
