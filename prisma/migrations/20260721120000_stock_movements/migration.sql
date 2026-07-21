CREATE TYPE "StockMovementReason" AS ENUM ('vente_pos', 'vente_web', 'reception', 'perte', 'correction');

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "authorId" UUID NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "StockMovementReason" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StockMovement_tenantId_productId_createdAt_idx" ON "StockMovement"("tenantId", "productId", "createdAt");

-- RLS : lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant.
-- Forme exacte alignée sur les policies "PromoCode" existantes (cf.
-- SELECT policyname, qual FROM pg_policies WHERE tablename = 'PromoCode';) —
-- "current_role"() doit être quoté (collision avec le mot réservé PostgreSQL
-- CURRENT_ROLE), sinon erreur de syntaxe 42601.
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_dashboard_select" ON "StockMovement"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "stock_movements_dashboard_all" ON "StockMovement"
  FOR ALL TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]))
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));
