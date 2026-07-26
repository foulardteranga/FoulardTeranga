-- Assertions RLS de la phase 1. Exécuter avec :
--   npx prisma db execute --file prisma/tests/rls_phase1.sql
-- Un échec se manifeste par une exception « ASSERTION ... » et interrompt le script.

begin;

-- Un profil owner de référence pour endosser son identité dans les tests.
-- 3529e5b3-… est l'owner créé par 20260713210000_seed_owner_profile.

-- 1. PlatformAuditLog : une gérante ne lit rien.
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

rollback;
