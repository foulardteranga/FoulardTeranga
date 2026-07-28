"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { TENANTS_CACHE_TAG } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";
import { findTenantByDomain, tenantSlugExists } from "./queries";
import { modulesForPlan } from "./plans";
import { defaultEmployeeRoles, initialStorefrontPage } from "./provisioning";
import { createTenantSchema, normalizeSlug, type CreateTenantInput } from "@/lib/validators/platform";

export type PlatformResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";

/**
 * Crée une boutique complète : compte Auth de la gérante, puis une transaction
 * unique (Tenant + profils d'accès + page vitrine + Profile owner + audit).
 * L'ordre est imposé par le spec §8 : l'échec le plus fréquent (« email déjà
 * utilisé ») est découvert avant toute écriture en base.
 */
export async function createTenant(
  input: CreateTenantInput
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = createTenantSchema.safeParse({ ...input, slug: normalizeSlug(input.slug) });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const data = parsed.data;

  if (await tenantSlugExists(data.slug)) {
    return { ok: false, error: "Ce slug est déjà utilisé." };
  }

  for (const domain of data.domains) {
    const conflict = await findTenantByDomain(domain);
    if (conflict) {
      return { ok: false, error: `Le domaine « ${domain} » est déjà rattaché à ${conflict.name}.` };
    }
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.ownerEmail,
    password: data.ownerPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { ok: false, error: "Cet email est déjà utilisé." };
    return { ok: false, error: GENERIC_ERROR };
  }
  const ownerId = created.user.id;

  const modules = modulesForPlan(data.plan);
  const page = initialStorefrontPage(data.name);

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: data.slug,
          name: data.name,
          primaryColor: data.primaryColor,
          accentColor: data.accentColor,
          logoText: data.logoText,
          domains: data.domains,
          plan: data.plan,
          enabledModules: modules,
        },
      });

      const roles = defaultEmployeeRoles(modules);
      if (roles.length > 0) {
        await tx.employeeRole.createMany({
          data: roles.map((role) => ({
            tenantId: tenant.id,
            name: role.name,
            permissions: role.permissions,
          })),
        });
      }

      await tx.storefrontPage.create({
        data: {
          tenantId: tenant.id,
          slug: "home",
          draft: page as unknown as Prisma.InputJsonValue,
          published: page as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });

      await tx.profile.create({
        data: {
          id: ownerId,
          tenantId: tenant.id,
          role: "owner",
          name: data.ownerName,
          email: data.ownerEmail,
        },
      });

      // Audit écrit dans la même transaction : PlatformAuditLog n'a aucune clé
      // étrangère (spec §1.3), donc « créée » et « tracée » sont indissociables.
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "tenant_created",
          tenantId: tenant.id,
          metadata: { slug: data.slug, name: data.name, plan: data.plan, modules },
        },
        tx
      );
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "owner_created",
          tenantId: tenant.id,
          targetId: ownerId,
          metadata: { email: data.ownerEmail, name: data.ownerName },
        },
        tx
      );
    });
  } catch {
    await admin.auth.admin.deleteUser(ownerId).catch(() => {
      // Rattrapage au mieux, comme dans createEmployee : le compte Auth orphelin
      // ne peut pas être signalé utilement ici, et sans Profile il ne donne accès
      // à aucune zone privilégiée.
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  updateTag(TENANTS_CACHE_TAG);
  revalidatePath("/boutiques");
  return { ok: true, slug: data.slug };
}
