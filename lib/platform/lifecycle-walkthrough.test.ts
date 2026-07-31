import { describe, it, expect, vi } from "vitest";

/**
 * Tâche 16 du plan phase 4 : le parcours utilisateur complet, relu de bout en
 * bout et prouvé par un test qui ENCHAÎNE les transitions sur un état partagé
 * — pas re-stubé à la main entre les étapes, contrairement au test « séquence
 * complète » de la phase 3 (handover §6), dont la faiblesse relevée était
 * exactement celle-ci : chaque étape imposait son propre état au lieu de
 * laisser le mock refléter ce que l'étape précédente venait d'écrire. Ici,
 * `tenant.update`/`tenant.delete` MUTENT `tenantRow` : si une transition
 * écrivait le mauvais statut ou oubliait de nettoyer un marqueur, ce test
 * l'attraperait au lieu de continuer sur un état figé.
 */

const authState = { role: "super_admin" as const };

const tenantRow: {
  id: string;
  slug: string;
  name: string;
  status: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  archivedAt: Date | null;
} = {
  id: "t1",
  slug: "boutique-test",
  name: "Boutique Test",
  status: "active",
  suspendedAt: null,
  suspendedReason: null,
  archivedAt: null,
};

const auditActions: string[] = [];
const deletedTenantIds: string[] = [];

const deletionModels = [
  "orderLine",
  "orderStatusEvent",
  "stockMovement",
  "order",
  "customer",
  "notification",
  "storefrontPage",
  "promoCode",
  "product",
  "profile",
  "employeeRole",
];

vi.mock("@/lib/impersonation/context", () => ({
  getActorContext: async () => ({
    actor: { userId: "admin-1", name: "Admin Plateforme", role: authState.role },
    effective: { tenantId: null, role: authState.role, permissions: [] },
    impersonation: null,
  }),
}));

vi.mock("@/lib/db/client", () => {
  const tx: Record<string, unknown> = {
    tenant: {
      // MUTE tenantRow, plutôt que de renvoyer un objet figé : c'est ce qui
      // permet au findUnique suivant de voir l'état réellement écrit.
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(tenantRow, data);
        return { ...tenantRow };
      },
      delete: async () => {
        deletedTenantIds.push(tenantRow.id);
        return { ...tenantRow };
      },
    },
    platformAuditLog: {
      create: async ({ data }: { data: { action: string } }) => {
        auditActions.push(data.action);
        return {};
      },
    },
  };
  for (const model of deletionModels) {
    tx[model] = { deleteMany: async () => ({ count: 0 }) };
  }
  return {
    prisma: {
      tenant: {
        findUnique: async () => ({ ...tenantRow }),
        update: (tx.tenant as { update: unknown }).update,
      },
      profile: {
        findMany: async () => [],
      },
      platformAuditLog: tx.platformAuditLog,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: async () => ({}) } },
  }),
}));

vi.mock("next/cache", () => ({
  updateTag: () => {},
  revalidatePath: () => {},
  unstable_cache:
    <T extends (...args: never[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

const { suspendTenant, reactivateTenant, archiveTenant, deleteTenant } = await import("@/lib/platform/lifecycle");

describe("parcours complet du cycle de vie d'une boutique", () => {
  it("active → suspendue → active → archivée → supprimée", async () => {
    expect(await suspendTenant("t1", { reason: "Impayé" })).toEqual({ ok: true });
    expect(tenantRow.status).toBe("suspended");
    expect(tenantRow.suspendedReason).toBe("Impayé");

    // Refus attendu à mi-parcours : on ne supprime pas une boutique suspendue.
    expect((await deleteTenant("t1", { confirmSlug: "boutique-test" })).ok).toBe(false);
    expect(tenantRow.status).toBe("suspended");

    expect(await reactivateTenant("t1")).toEqual({ ok: true });
    expect(tenantRow.status).toBe("active");
    expect(tenantRow.suspendedAt).toBeNull();
    expect(tenantRow.suspendedReason).toBeNull();
    expect(tenantRow.archivedAt).toBeNull();

    expect(await archiveTenant("t1")).toEqual({ ok: true });
    expect(tenantRow.status).toBe("archived");

    // Refus attendu : mauvais slug de confirmation, sans effet de bord.
    expect((await deleteTenant("t1", { confirmSlug: "mauvais-slug" })).ok).toBe(false);
    expect(tenantRow.status).toBe("archived");
    expect(deletedTenantIds).toHaveLength(0);

    expect(await deleteTenant("t1", { confirmSlug: "boutique-test" })).toEqual({ ok: true });
    expect(deletedTenantIds).toEqual(["t1"]);

    // Le journal survit à la suppression (spec §1.3) : quatre entrées, la
    // dernière tenant_deleted — jamais re-stubé, cumulé au fil du parcours.
    expect(auditActions).toEqual(["tenant_suspended", "tenant_reactivated", "tenant_archived", "tenant_deleted"]);
  });
});
