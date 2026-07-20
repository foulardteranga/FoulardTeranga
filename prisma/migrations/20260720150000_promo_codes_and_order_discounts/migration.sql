CREATE TYPE "PromoKind" AS ENUM ('percent', 'amount');

CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "PromoKind" NOT NULL,
  "value" INTEGER NOT NULL,
  "minTotal" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "vipOnly" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PromoCode_tenantId_code_key" ON "PromoCode"("tenantId", "code");
CREATE INDEX "PromoCode_tenantId_idx" ON "PromoCode"("tenantId");

ALTER TABLE "Order" ADD COLUMN "promoCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "promoDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pointsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pointsDiscount" INTEGER NOT NULL DEFAULT 0;

-- RLS : lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant.
-- Aucun accès anon/customer : la validation d'un code passe par les Server Actions
-- Prisma (connexion directe, hors RLS), jamais par PostgREST.
--
-- NOTE : "current_role" est un mot réservé PostgreSQL (CURRENT_ROLE). La fonction
-- applicative doit être appelée sous forme d'identifiant quoté "current_role"(),
-- sinon `current_role()` (non quoté) provoque une erreur de syntaxe (42601).
-- Forme et cast alignés sur les policies existantes de la table "Product"
-- (cf. SELECT policyname, qual FROM pg_policies WHERE tablename = 'Product';).
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes_dashboard_select" ON "PromoCode"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "promo_codes_dashboard_all" ON "PromoCode"
  FOR ALL TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]))
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));
