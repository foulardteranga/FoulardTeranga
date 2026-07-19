-- public_bucket_allows_listing advisor: the bucket is already public=true, which
-- serves objects by URL without consulting storage.objects RLS. This SELECT
-- policy only enabled the `list` API (file enumeration), unused by the app.
drop policy if exists "storefront_images_select_public" on storage.objects;
