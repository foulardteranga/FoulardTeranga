-- Page vitrine "flexible content" par tenant : contenu sérialisé en JSON,
-- versionné brouillon (draft) / publié (published). v1 : une ligne "home".
create table "StorefrontPage" (
  "id"          text not null default gen_random_uuid()::text,
  "tenantId"    text not null references "Tenant"("id"),
  "slug"        text not null default 'home',
  "draft"       jsonb not null,
  "published"   jsonb not null,
  "publishedAt" timestamp(3),
  "updatedAt"   timestamp(3) not null,
  "createdAt"   timestamp(3) not null default now(),
  constraint "StorefrontPage_pkey" primary key ("id")
);

create unique index "StorefrontPage_tenantId_slug_key" on "StorefrontPage" ("tenantId", "slug");
create index "StorefrontPage_tenantId_idx" on "StorefrontPage" ("tenantId");

-- RLS : lecture publique (la vitrine affiche le "published"), écriture réservée
-- aux owner/staff de la boutique. Mêmes helpers que les migrations existantes.
alter table "StorefrontPage" enable row level security;

create policy "storefront_pages_select_public" on "StorefrontPage"
  for select using (true);

create policy "storefront_pages_insert_staff" on "StorefrontPage"
  for insert with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "storefront_pages_update_staff" on "StorefrontPage"
  for update using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );
