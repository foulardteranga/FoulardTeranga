-- Create enums
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE "TenantPlan" AS ENUM ('essentiel', 'pro');

-- Add new columns to Tenant
ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "Tenant" ADD COLUMN "plan" "TenantPlan" NOT NULL DEFAULT 'essentiel';
ALTER TABLE "Tenant" ADD COLUMN "enabledModules" text[] NOT NULL DEFAULT array['pos','dash','orders','inv','cust','theme','vitrine','boutique'];
ALTER TABLE "Tenant" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "suspendedReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Les boutiques existantes précèdent la notion de périmètre : elles avaient
-- accès à tout. On les aligne sur le palier complet avant d'imposer le socle,
-- sinon la contrainte ci-dessous échouerait sur des lignes à tableau vide.
UPDATE "Tenant"
SET "enabledModules" = array['pos','dash','orders','inv','cust','mkt','fin','theme','vitrine','boutique'],
    "plan" = 'pro'
WHERE cardinality("enabledModules") = 0;

-- Socle minimal : sans « dash », une gérante se connecterait sans aucun écran
-- accessible et atterrirait sur sa propre page de connexion, sans issue
-- (cf. spec §4). La contrainte rend cet état impossible, même si une écriture
-- contourne le validateur Zod.
ALTER TABLE "Tenant" ADD CONSTRAINT tenant_min_modules
  CHECK ('dash' = any("enabledModules"));
