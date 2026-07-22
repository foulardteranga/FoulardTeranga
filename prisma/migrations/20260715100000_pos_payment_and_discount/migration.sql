create type "PaymentMethod" as enum ('espece', 'mm', 'mixte');
alter table "Order" add column "paymentMethod" "PaymentMethod";
alter table "OrderLine" add column "discount" integer not null default 0;
