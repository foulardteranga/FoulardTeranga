-- Nouveaux compteurs de fidélité sur Customer (nombre de commandes confirmées,
-- montant total dépensé), incrémentés désormais par confirmOrder à chaque
-- validation de commande web (miroir de la déduction de stock).
alter table "Customer" add column "ordersCount" integer not null default 0;
alter table "Customer" add column "totalSpent" integer not null default 0;

-- Backfill : préserve l'affichage démo existant. Order.customerId est déjà
-- renseigné sur les 6 commandes seedées au sous-projet 1 (vérifié en direct),
-- mais ces 6 commandes ne représentent qu'une infime partie des compteurs de
-- démo d'origine (lib/data/clients.ts) — ce script réinjecte ces valeurs
-- d'origine telles quelles, comme c'était déjà le cas avant cette migration.
update "Customer" set "ordersCount" = 14, "totalSpent" = 420000 where id = 'c1';
update "Customer" set "ordersCount" = 8,  "totalSpent" = 196000 where id = 'c2';
update "Customer" set "ordersCount" = 11, "totalSpent" = 312000 where id = 'c3';
update "Customer" set "ordersCount" = 4,  "totalSpent" = 88000  where id = 'c4';
update "Customer" set "ordersCount" = 2,  "totalSpent" = 34500  where id = 'c5';
update "Customer" set "ordersCount" = 9,  "totalSpent" = 254000 where id = 'c6';
