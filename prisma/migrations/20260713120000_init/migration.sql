-- Enums
create type "Role" as enum ('super_admin', 'owner', 'staff', 'customer');
create type "ProductCategory" as enum ('Foulards', 'Turbans', 'Tissus', 'Accessoires');
create type "CustomerSegment" as enum ('VIP', 'Fidele', 'Nouvelle');
create type "OrderStatus" as enum ('nouvelle', 'confirmee', 'preparation', 'livree', 'refusee');
create type "OrderChannel" as enum ('Web', 'WhatsApp', 'Boutique');

-- Sequence for human-readable order references (#TER-XXXX), floor matches the
-- app's existing in-memory convention (lib/store/useShop.ts's nextOrderRef).
create sequence orders_ref_seq start 2701;

-- Tenant
create table "Tenant" (
  id text primary key,
  slug text not null unique,
  name text not null,
  "primaryColor" text not null,
  "accentColor" text not null,
  "logoText" text not null,
  domains text[] not null default '{}',
  "createdAt" timestamptz not null default now()
);

-- Profile (mirrors auth.users; rows created by a trigger in the Auth sub-project)
create table "Profile" (
  id uuid primary key,
  "tenantId" text not null references "Tenant"(id),
  role "Role" not null,
  name text not null,
  "createdAt" timestamptz not null default now()
);
create index "Profile_tenantId_idx" on "Profile" ("tenantId");

-- Product
create table "Product" (
  id text primary key,
  "tenantId" text not null references "Tenant"(id),
  category "ProductCategory" not null,
  name text not null,
  variant text not null,
  price integer not null,
  stock integer not null,
  swatch text not null,
  colors text[] not null default '{}',
  motif text not null,
  lengths text[] not null default '{}',
  description text not null,
  "oldPrice" integer,
  badge text,
  featured boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index "Product_tenantId_idx" on "Product" ("tenantId");

-- Customer
create table "Customer" (
  id text primary key,
  "tenantId" text not null references "Tenant"(id),
  "profileId" uuid unique references "Profile"(id),
  name text not null,
  initials text not null,
  phone text not null,
  place text not null,
  points integer not null default 0,
  vip boolean not null default false,
  segment "CustomerSegment" not null,
  "createdAt" timestamptz not null default now()
);
create index "Customer_tenantId_idx" on "Customer" ("tenantId");

-- Order
create table "Order" (
  id text primary key,
  "tenantId" text not null references "Tenant"(id),
  ref text not null unique default ('#TER-' || nextval('orders_ref_seq')),
  "customerId" text references "Customer"(id),
  "clientName" text not null,
  place text not null,
  phone text not null,
  channel "OrderChannel" not null,
  status "OrderStatus" not null default 'nouvelle',
  "vipAtOrder" boolean not null default false,
  total integer not null,
  "createdAt" timestamptz not null default now()
);
create index "Order_tenantId_idx" on "Order" ("tenantId");

-- OrderLine
create table "OrderLine" (
  id text primary key,
  "orderId" text not null references "Order"(id),
  "productId" text not null references "Product"(id),
  "nameAtOrder" text not null,
  qty integer not null,
  "unitPrice" integer not null,
  "lineTotal" integer not null
);
create index "OrderLine_orderId_idx" on "OrderLine" ("orderId");
create index "OrderLine_productId_idx" on "OrderLine" ("productId");
