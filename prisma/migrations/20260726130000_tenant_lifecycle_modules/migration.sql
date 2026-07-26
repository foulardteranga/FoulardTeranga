CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE "TenantPlan" AS ENUM ('essentiel', 'pro');

ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'active';

-- La boutique existante précède la notion de périmètre : elle avait accès à
-- tout. Le défaut complet rétro-remplit sa ligne dès l'ADD COLUMN ; on le
-- resserre ensuite au palier essentiel pour toute future boutique, sans
-- toucher à la ligne déjà en base (spec §1).
ALTER TABLE "Tenant" ADD COLUMN "plan" "TenantPlan" NOT NULL DEFAULT 'pro';
ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'essentiel';

ALTER TABLE "Tenant" ADD COLUMN "enabledModules" text[] NOT NULL DEFAULT array['pos','dash','orders','inv','cust','mkt','fin','theme','vitrine','boutique'];
ALTER TABLE "Tenant" ALTER COLUMN "enabledModules" SET DEFAULT array['pos','dash','orders','inv','cust','theme','vitrine','boutique'];

ALTER TABLE "Tenant" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "suspendedReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Tenant" ADD CONSTRAINT tenant_min_modules
  CHECK ('dash' = any("enabledModules"));
