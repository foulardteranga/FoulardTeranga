-- Bucket public pour les images éditables de la vitrine (hero, story, cats,
-- lookbook), compressées côté serveur avant upload (lib/storefront/imageUpload.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'storefront-images',
  'storefront-images',
  true,
  10485760, -- 10 Mo, aligné sur MAX_UPLOAD_BYTES côté serveur
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS : lecture publique (images décoratives, non sensibles), écriture
-- réservée à owner/staff du tenant propriétaire du dossier (premier segment
-- du chemin = tenantId). Réutilise les helpers de la migration 20260713120100_rls.
create policy "storefront_images_select_public"
on storage.objects for select
using (bucket_id = 'storefront-images');

create policy "storefront_images_write_staff"
on storage.objects for all
using (
  bucket_id = 'storefront-images'
  and (storage.foldername(name))[1] = public.current_tenant_id()
  and public.current_role() in ('owner', 'staff')
)
with check (
  bucket_id = 'storefront-images'
  and (storage.foldername(name))[1] = public.current_tenant_id()
  and public.current_role() in ('owner', 'staff')
);
