-- La policy tenants_select_public (using(true)) donne un accès en lecture à
-- TOUTE ligne Tenant pour anon/authenticated — RLS ne restreint que les
-- lignes, pas les colonnes. Les six colonnes de cycle de vie ajoutées en
-- Task 1 (status, plan, enabledModules, suspendedAt, suspendedReason,
-- archivedAt) sont donc devenues lisibles par la clé publique anon, alors
-- qu'aucun code applicatif ne les lit via PostgREST aujourd'hui (accès
-- exclusivement par Prisma, qui contourne policies et GRANT en tant que
-- rôle propriétaire des tables). suspendedReason en particulier portera des
-- notes potentiellement commerciales une fois la phase 2 construite.
--
-- Postgres ne permet pas de retirer une colonne précise d'un rôle qui a un
-- SELECT global sur la table : on retire d'abord ce SELECT global, puis on
-- ré-accorde explicitement les colonnes que chaque rôle doit garder.
revoke select on "Tenant" from anon, authenticated;

grant select (
  "id", "slug", "name", "tagline", "primaryColor", "accentColor", "font",
  "logoText", "whatsappPhone", "domains", "createdAt"
) on "Tenant" to anon, authenticated;

-- enabledModules reste lisible par authenticated (pas par anon) :
-- resolveSession() (lib/auth/session.ts) le lit via l'embed PostgREST
-- tenant:Tenant(enabledModules) sous le JWT de l'utilisateur connecté —
-- c'est le mécanisme même de l'intersection de permissions introduite en
-- Task 7. Le retirer casserait hasModuleAccess() pour toute session
-- owner/staff.
grant select ("enabledModules") on "Tenant" to authenticated;
