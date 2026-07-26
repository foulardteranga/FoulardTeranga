-- Corrige tenant_lifecycle_modules (20260726130000) : ADD COLUMN ... DEFAULT
-- rétro-remplit immédiatement les lignes existantes, donc l'UPDATE conditionné
-- par cardinality("enabledModules") = 0 de cette migration-là n'a jamais pu
-- matcher aucune ligne. Résultat réel : la boutique déjà en base était
-- restée sur le palier essentiel (8 modules, plan essentiel) au lieu du
-- palier complet attendu pour toute boutique antérieure à la notion de
-- périmètre (spec §1).
--
-- Ce correctif (a) resserre le défaut de colonne au palier essentiel pour
-- toute future boutique — ALTER COLUMN ... SET DEFAULT ne touche aucune ligne
-- déjà en base — et (b) corrige directement la ligne déjà affectée.
alter table "Tenant" alter column "plan" set default 'essentiel';
alter table "Tenant" alter column "enabledModules" set default array['pos','dash','orders','inv','cust','theme','vitrine','boutique'];

update "Tenant"
set "plan" = 'pro',
    "enabledModules" = array['pos','dash','orders','inv','cust','mkt','fin','theme','vitrine','boutique']
where slug = 'foulard-teranga';
