-- La policy autorisait un owner à écrire TOUTES les colonnes de sa ligne
-- Tenant via PostgREST (clé anonyme + JWT de la gérante), dont « domains » —
-- soit le détournement du trafic vitrine d'une autre boutique dès qu'une
-- seconde existe. Elle ne sert aucun besoin applicatif : l'écran
-- Personnalisation persiste via la Server Action updateTenantTheme, qui passe
-- par Prisma et contourne la RLS (spec §5).
drop policy "tenants_update_owner" on "Tenant";
