-- Tenant: owner peut modifier sa propre boutique (jusqu'ici seul super_admin
-- pouvait écrire) — nécessaire pour que l'écran Personnalisation persiste.
create policy "tenants_update_owner" on "Tenant"
  for update using (
    id = public.current_tenant_id() and public.current_role() = 'owner'
  )
  with check (
    id = public.current_tenant_id() and public.current_role() = 'owner'
  );

-- Notification : lecture/écriture réservées à owner/staff de la boutique.
alter table "Notification" enable row level security;

create policy "notifications_all_staff" on "Notification"
  for all using (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  )
  with check (
    "tenantId" = public.current_tenant_id() and public.current_role() in ('owner', 'staff')
  );

-- Profile : un nouvel utilisateur authentifié peut créer sa propre fiche,
-- mais seulement avec le rôle 'customer' — impossible de s'auto-attribuer
-- owner/staff/super_admin par ce chemin. current_tenant_id() est inutilisable
-- ici (la fiche n'existe pas encore), donc on vérifie juste que tenantId
-- pointe vers une boutique existante.
create policy "profiles_insert_self_customer" on "Profile"
  for insert with check (
    id = auth.uid()
    and role = 'customer'
    and exists (select 1 from "Tenant" t where t.id = "tenantId")
  );

-- Customer : une cliente connectée peut lire/mettre à jour sa propre fiche
-- (matchée via profileId), en plus de l'accès owner/staff déjà existant.
create policy "customers_select_self" on "Customer"
  for select using ("profileId" = auth.uid());

create policy "customers_update_self" on "Customer"
  for update using ("profileId" = auth.uid())
  with check ("profileId" = auth.uid());

-- Order : une cliente connectée peut lire ses propres commandes (matchées
-- via Customer.profileId), en plus de l'accès owner/staff déjà existant.
create policy "orders_select_self" on "Order"
  for select using (
    exists (
      select 1 from "Customer" c
      where c.id = "Order"."customerId" and c."profileId" = auth.uid()
    )
  );

-- Realtime : diffuse les changements de Notification aux abonnés (cloche
-- back-office) — nécessaire pour la mise à jour sans rechargement de page.
alter publication supabase_realtime add table "Notification";
