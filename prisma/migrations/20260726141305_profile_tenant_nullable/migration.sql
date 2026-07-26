alter table "Profile" alter column "tenantId" drop not null;

-- Un compte plateforme (super_admin) n'appartient à aucune boutique ; tout
-- autre rôle en a obligatoirement une. Exprimé en base pour que l'incohérence
-- soit impossible plutôt que seulement déconseillée (spec §1).
alter table "Profile" add constraint profile_tenant_role_coherent
  check ((role = 'super_admin' and "tenantId" is null)
      or (role <> 'super_admin' and "tenantId" is not null));
