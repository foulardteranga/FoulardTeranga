CREATE TYPE "OrderAuditAction" AS ENUM ('archived', 'restored', 'deleted');

CREATE TABLE "OrderAuditLog" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "orderRef"        TEXT NOT NULL,
  "action"          "OrderAuditAction" NOT NULL,
  "reason"          TEXT,
  "actorId"         UUID NOT NULL,
  "actorRole"       "Role" NOT NULL,
  "stockReconciled" BOOLEAN NOT NULL DEFAULT false,
  "orderSnapshot"   JSONB NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderAuditLog_tenantId_createdAt_idx" ON "OrderAuditLog"("tenantId", "createdAt");
CREATE INDEX "OrderAuditLog_orderRef_idx" ON "OrderAuditLog"("orderRef");

-- Lecture réservée à owner ; écriture ouverte à owner+staff (ce sont eux qui
-- déclenchent archiveOrder/restoreOrder/deleteOrderPermanently).
ALTER TABLE "OrderAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_audit_log_insert_staff" ON "OrderAuditLog"
  FOR INSERT TO authenticated
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "order_audit_log_select_owner" ON "OrderAuditLog"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

-- Aujourd'hui "Order" n'a aucune policy DELETE (default-deny RLS) : la
-- suppression est actuellement bloquée pour tout le monde. Autorisée
-- uniquement pour une commande déjà archivée.
CREATE POLICY "orders_delete_staff" ON "Order"
  FOR DELETE TO authenticated
  USING (
    "tenantId" = current_tenant_id()
    AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"])
    AND status = 'archivee'::"OrderStatus"
  );
