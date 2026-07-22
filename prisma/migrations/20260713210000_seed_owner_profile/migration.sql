-- Ligne Profile pour le compte owner provisionné manuellement via le dashboard
-- Supabase Auth (Authentication > Users), suite à la Tâche 7 du plan
-- docs/superpowers/plans/2026-07-13-real-auth.md. L'id ci-dessous est l'uuid
-- réel d'auth.users trouvé par lecture seule après la création du compte.
insert into "Profile" (id, "tenantId", role, name)
values ('3529e5b3-304f-48ea-bc0f-ec82a74e8ae0', 'foulard-teranga', 'owner', 'Will-Test');
