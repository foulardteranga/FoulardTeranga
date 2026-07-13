-- Helper functions. SECURITY DEFINER is required so that evaluating these
-- functions from inside a policy on "Profile" itself does not recurse through
-- RLS a second time (which would either deadlock the policy check or always
-- see zero rows).
create or replace function public.current_tenant_id() returns text
language sql stable security definer set search_path = public as $$
  select "tenantId" from "Profile" where id = auth.uid()
$$;

create or replace function public.current_role() returns "Role"
language sql stable security definer set search_path = public as $$
  select role from "Profile" where id = auth.uid()
$$;

-- Tenant: public read (storefront needs the theme), writes reserved to super_admin.
alter table "Tenant" enable row level security;

create policy "tenants_select_public" on "Tenant"
  for select using (true);

create policy "tenants_write_super_admin" on "Tenant"
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- Profile: self access, staff can read their tenant's profiles, super_admin reads all.
alter table "Profile" enable row level security;

create policy "profiles_select_self" on "Profile"
  for select using (id = auth.uid());

create policy "profiles_select_staff" on "Profile"
  for select using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "profiles_select_super_admin" on "Profile"
  for select using (public.current_role() = 'super_admin');

create policy "profiles_update_self" on "Profile"
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Product: public read (storefront catalog), writes reserved to owner/staff of the same tenant.
alter table "Product" enable row level security;

create policy "products_select_public" on "Product"
  for select using (true);

create policy "products_insert_staff" on "Product"
  for insert with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "products_update_staff" on "Product"
  for update using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "products_delete_staff" on "Product"
  for delete using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- Customer: no public/customer read in v1 (no customer login yet) — owner/staff of the same tenant only.
alter table "Customer" enable row level security;

create policy "customers_all_staff" on "Customer"
  for all using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- Order: anonymous INSERT allowed (v1 checkout has no customer login, CLAUDE.md §4 — a
-- KYC mini-form is enough), but SELECT/UPDATE stay reserved to owner/staff of the tenant.
-- The DB cannot verify the inserted total is honest (no cross-row arithmetic in RLS);
-- server-side total recomputation is the future Server Action's job (sub-project 4 of
-- the overall migration), not this table's RLS.
alter table "Order" enable row level security;

create policy "orders_insert_public" on "Order"
  for insert with check (true);

create policy "orders_select_staff" on "Order"
  for select using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

create policy "orders_update_staff" on "Order"
  for update using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- OrderLine: same public-insert / staff-read shape as Order, joined through orderId
-- since OrderLine has no tenantId column of its own.
alter table "OrderLine" enable row level security;

create policy "order_lines_insert_public" on "OrderLine"
  for insert with check (true);

create policy "order_lines_select_staff" on "OrderLine"
  for select using (
    exists (
      select 1 from "Order" o
      where o.id = "OrderLine"."orderId"
        and o."tenantId" = public.current_tenant_id()
        and public.current_role() in ('owner', 'staff')
    )
  );

create policy "order_lines_update_staff" on "OrderLine"
  for update using (
    exists (
      select 1 from "Order" o
      where o.id = "OrderLine"."orderId"
        and o."tenantId" = public.current_tenant_id()
        and public.current_role() in ('owner', 'staff')
    )
  );
