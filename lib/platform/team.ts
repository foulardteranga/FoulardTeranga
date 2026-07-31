"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";
import {
  resetOwnerPasswordSchema,
  createOwnerSchema,
  type ResetOwnerPasswordInput,
  type CreateOwnerInput,
} from "@/lib/validators/platform";

export type PlatformResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";

/**
 * Réinitialise le mot de passe de la gérante d'une boutique. Le nouveau mot de
 * passe ne transite jamais par `PlatformAuditLog.metadata` (spec §6, onglet
 * Équipe) : la trace prouve QUE l'action a eu lieu, jamais avec QUEL secret.
 */
export async function resetOwnerPassword(
  tenantId: string,
  ownerProfileId: string,
  input: ResetOwnerPasswordInput
): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = resetOwnerPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const data = parsed.data;

  try {
    const profile = await prisma.profile.findUnique({ where: { id: ownerProfileId } });
    // Contrôle d'autorisation avant tout appel Supabase Auth : un tenantId/
    // ownerProfileId incohérent (formulaire périmé) ne doit jamais pouvoir
    // réinitialiser le mot de passe de la gérante d'UNE AUTRE boutique.
    if (!profile || profile.tenantId !== tenantId || profile.role !== "owner") {
      return { ok: false, error: "Cette gérante n'appartient pas à cette boutique." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(ownerProfileId, { password: data.password });
    if (error) return { ok: false, error: GENERIC_ERROR };

    // L'audit n'est écrit qu'après le succès Auth : « tracé » ne doit jamais
    // mentir sur ce qui s'est réellement passé.
    await recordPlatformAction({
      actorId: actor.userId,
      action: "owner_password_reset",
      tenantId,
      targetId: ownerProfileId,
      metadata: { ownerName: profile.name, ownerEmail: profile.email ?? "" },
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

/**
 * Rattache une gérante à une boutique qui n'en a pas (spec §6) : compte Auth
 * d'abord, puis transaction Prisma (Profile + audit), même ordre que
 * `createTenant` (lib/platform/actions.ts) — l'échec le plus fréquent (« email
 * déjà utilisé ») coûte alors zéro écriture en base.
 */
export async function createTenantOwner(tenantId: string, input: CreateOwnerInput): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = createOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const data = parsed.data;

  try {
    const existingOwner = await prisma.profile.findFirst({
      where: { tenantId, role: "owner" },
      select: { id: true },
    });
    if (existingOwner) return { ok: false, error: "Cette boutique a déjà une gérante." };

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    if (!tenant) return { ok: false, error: "Boutique introuvable." };

    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      if (createError?.code === "email_exists") {
        return { ok: false, error: "Cette adresse email est déjà utilisée." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
    const ownerId = created.user.id;

    // Try interne dédié au rollback du compte Auth si la transaction DB échoue
    // (distinct du try englobant : celui-ci ne fait que ce rattrapage précis).
    try {
      await prisma.$transaction(async (tx) => {
        await tx.profile.create({
          data: {
            id: ownerId,
            tenantId,
            role: "owner",
            name: data.name,
            email: data.email,
            active: true,
          },
        });
        await recordPlatformAction(
          {
            actorId: actor.userId,
            action: "owner_created",
            tenantId,
            targetId: ownerId,
            metadata: { ownerName: data.name, ownerEmail: data.email },
          },
          tx
        );
      });
    } catch {
      await admin.auth.admin.deleteUser(ownerId).catch(() => {
        // Rattrapage au mieux, comme dans createTenant : le compte Auth orphelin
        // ne peut pas être signalé utilement ici, et sans Profile il ne donne accès
        // à aucune zone privilégiée.
      });
      return { ok: false, error: GENERIC_ERROR };
    }

    revalidatePath(`/boutiques/${tenant.slug}`);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
