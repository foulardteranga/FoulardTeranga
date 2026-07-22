CREATE TABLE "OrderStatusEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "authorId" UUID,
  "status" "OrderStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderStatusEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderStatusEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderStatusEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OrderStatusEvent_tenantId_orderId_createdAt_idx" ON "OrderStatusEvent"("tenantId", "orderId", "createdAt");

-- RLS : lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant,
-- même forme que "StockMovement" (cf. prisma/migrations/20260721190448_stock_movements).
ALTER TABLE "OrderStatusEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_status_events_dashboard_select" ON "OrderStatusEvent"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "order_status_events_dashboard_all" ON "OrderStatusEvent"
  FOR ALL TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]))
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));
