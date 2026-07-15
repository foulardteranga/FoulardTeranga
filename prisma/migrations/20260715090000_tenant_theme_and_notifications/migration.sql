-- Champs de personnalisation manquants sur Tenant (l'écran back-office
-- "Personnalisation" existait déjà côté UI mais ne persistait rien) et
-- nouvelle table Notification (remplace le mock lib/data/notifs.ts).
alter table "Tenant" add column "tagline" text not null default '';
alter table "Tenant" add column "font" text not null default 'Playfair Display';
alter table "Tenant" add column "whatsappPhone" text;

create type "NotificationType" as enum ('nouvelle_commande', 'stock_bas', 'paiement_recu');

create table "Notification" (
  "id" text not null default gen_random_uuid()::text,
  "tenantId" text not null references "Tenant"("id"),
  "type" "NotificationType" not null,
  "title" text not null,
  "body" text not null,
  "href" text not null,
  "read" boolean not null default false,
  "createdAt" timestamp(3) not null default now(),
  constraint "Notification_pkey" primary key ("id")
);

create index "Notification_tenantId_idx" on "Notification"("tenantId");
