drop policy if exists "Public read showroom images" on storage.objects;
drop policy if exists "Authenticated upload showroom images" on storage.objects;
drop policy if exists "Authenticated update showroom images" on storage.objects;
drop policy if exists "Authenticated delete showroom images" on storage.objects;

create policy showroom_images_administrator_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'showroom-images'
  and (select platform_private.is_admin())
);

create policy showroom_images_administrator_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'showroom-images'
  and (select platform_private.is_admin())
);

create policy showroom_images_administrator_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'showroom-images'
  and (select platform_private.is_admin())
)
with check (
  bucket_id = 'showroom-images'
  and (select platform_private.is_admin())
);

create policy showroom_images_administrator_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'showroom-images'
  and (select platform_private.is_admin())
);
