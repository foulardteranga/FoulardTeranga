-- EmployeeRole : profils d'accès personnalisés (ex. Gérant, Caissier), un
-- nom unique par tenant, la liste des modules dashboard autorisés.
CREATE TABLE "EmployeeRole" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeRole_tenantId_name_key" ON "EmployeeRole"("tenantId", "name");
CREATE INDEX "EmployeeRole_tenantId_idx" ON "EmployeeRole"("tenantId");

-- Profile : email (affichage écran Équipe, copié depuis Supabase Auth à la
-- création — évite un appel Admin API à chaque lecture), employeeRoleId
-- (ON DELETE RESTRICT : impossible de supprimer un profil d'accès tant que
-- des employés y sont rattachés — appliqué par la DB, pas seulement par
-- l'application), active (désactivation sans suppression, cf. design §1).
ALTER TABLE "Profile" ADD COLUMN "email" TEXT;
ALTER TABLE "Profile" ADD COLUMN "employeeRoleId" TEXT;
ALTER TABLE "Profile" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_employeeRoleId_fkey" FOREIGN KEY ("employeeRoleId") REFERENCES "EmployeeRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Profile_employeeRoleId_idx" ON "Profile"("employeeRoleId");

-- RLS EmployeeRole : lecture par owner/staff du tenant (nécessaire pour que
-- resolveSession() puisse embarquer les permissions d'un compte staff via le
-- client Supabase lié à sa propre session, cf. lib/auth/index.ts) ; écriture
-- réservée à owner (les Server Actions écrivent via Prisma qui bypasse la
-- RLS — ces policies sont une défense en profondeur, forme alignée sur
-- "current_role"() quoté comme dans StockMovement/PromoCode).
ALTER TABLE "EmployeeRole" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_roles_select_staff" ON "EmployeeRole"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "employee_roles_insert_owner" ON "EmployeeRole"
  FOR INSERT TO authenticated
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

CREATE POLICY "employee_roles_update_owner" ON "EmployeeRole"
  FOR UPDATE TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role")
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

CREATE POLICY "employee_roles_delete_owner" ON "EmployeeRole"
  FOR DELETE TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

-- RLS Profile : owner peut créer/mettre à jour des profils staff de son
-- tenant (défense en profondeur — l'écriture applicative passe par Prisma).
CREATE POLICY "profiles_insert_owner" ON "Profile"
  FOR INSERT TO authenticated
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role" AND role = 'staff'::"Role");

CREATE POLICY "profiles_update_owner" ON "Profile"
  FOR UPDATE TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role" AND role = 'staff'::"Role")
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role" AND role = 'staff'::"Role");
