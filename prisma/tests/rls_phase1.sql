-- Assertions RLS de la phase 1. Exécuter avec :
--   npx prisma db execute --file prisma/tests/rls_phase1.sql
-- Un échec se manifeste par une exception « ASSERTION ... » et interrompt le script.

begin;

-- Ligne réelle, insérée par le rôle de connexion (propriétaire de la table,
-- contourne la RLS) — sans elle, le test 1 ci-dessous serait vacuously vrai
-- sur une table vide, qu'une policy RLS existe ou non.
insert into "PlatformAuditLog" (id, "actorId", action)
values ('rls-test-seed', '3529e5b3-304f-48ea-bc0f-ec82a74e8ae0', 'tenant_created');

-- Un profil owner de référence pour endosser son identité dans les tests.
-- 3529e5b3-… est l'owner créé par 20260713210000_seed_owner_profile.

-- 1. PlatformAuditLog : une gérante ne lit rien, même si une ligne existe réellement.
set local role authenticated;
set local request.jwt.claims = '{"sub":"3529e5b3-304f-48ea-bc0f-ec82a74e8ae0"}';

do $$
declare visible int;
begin
  select count(*) into visible from "PlatformAuditLog";
  if visible <> 0 then
    raise exception 'ASSERTION ÉCHOUÉE : un owner voit % ligne(s) de PlatformAuditLog, attendu 0', visible;
  end if;
end $$;

-- 2. PlatformAuditLog : une gérante ne peut pas y écrire.
do $$
begin
  begin
    insert into "PlatformAuditLog" (id, "actorId", action)
    values ('test-audit-1', '3529e5b3-304f-48ea-bc0f-ec82a74e8ae0', 'tenant_created');
    raise exception 'ASSERTION ÉCHOUÉE : un owner a pu écrire dans PlatformAuditLog';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- 3. Tenant : une gérante ne peut plus écrire sa propre ligne via PostgREST.
do $$
begin
  begin
    update "Tenant" set "domains" = array['boutique-voisine.ci'] where id = 'foulard-teranga';
    if found then
      raise exception 'ASSERTION ÉCHOUÉE : un owner a pu écrire Tenant.domains';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- 4. Tenant : la lecture publique reste ouverte (la vitrine en dépend).
do $$
declare visible int;
begin
  select count(*) into visible from "Tenant";
  if visible = 0 then
    raise exception 'ASSERTION ÉCHOUÉE : la lecture publique de Tenant est cassée';
  end if;
end $$;

rollback;
