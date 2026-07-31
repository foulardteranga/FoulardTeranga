import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Ordre de suppression des lignes d'une boutique (spec §9). Vérifié contre la
 * base le 2026-07-31 : AUCUNE clé étrangère de ce schéma n'est en `CASCADE`
 * (toutes en `NO ACTION`/`RESTRICT`), donc chaque table doit partir avant celles
 * dont elle dépend. Toute nouvelle table portant un `tenantId` DOIT être ajoutée
 * ici, sans quoi la suppression échouera sur une violation de contrainte.
 *
 * `PlatformAuditLog` en est délibérément absente : elle n'a aucune FK vers
 * `Tenant` ni `Profile` précisément pour survivre à cette opération (spec §1.3) —
 * l'entrée `tenant_deleted` est la trace qu'on veut conserver.
 */
export const TENANT_DELETION_ORDER: readonly string[] = [
  "orderLine", // FK orderId → Order, productId → Product
  "orderStatusEvent", // FK orderId → Order, authorId → Profile
  "stockMovement", // FK productId → Product, authorId → Profile
  "order", // FK customerId → Customer
  "customer", // FK profileId → Profile
  "notification",
  "storefrontPage",
  "promoCode",
  "product",
  "profile", // FK employeeRoleId → EmployeeRole
  "employeeRole",
  "tenant",
] as const;

/**
 * Supprime toutes les lignes d'une boutique, dans l'ordre ci-dessus. Reçoit un
 * client de transaction : l'appelant décide de la portée transactionnelle.
 */
export async function deleteTenantRows(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  // OrderLine ne porte pas de tenantId — elle passe par sa commande.
  await tx.orderLine.deleteMany({ where: { order: { tenantId } } });
  await tx.orderStatusEvent.deleteMany({ where: { tenantId } });
  await tx.stockMovement.deleteMany({ where: { tenantId } });
  await tx.order.deleteMany({ where: { tenantId } });
  await tx.customer.deleteMany({ where: { tenantId } });
  await tx.notification.deleteMany({ where: { tenantId } });
  await tx.storefrontPage.deleteMany({ where: { tenantId } });
  await tx.promoCode.deleteMany({ where: { tenantId } });
  await tx.product.deleteMany({ where: { tenantId } });
  await tx.profile.deleteMany({ where: { tenantId } });
  await tx.employeeRole.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
}
