-- 007_storage_pics_bucket.sql
-- Storage policies for the Pics bucket (avatars, org logos, banners).
-- Safe if the bucket was created in the Supabase dashboard first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'Pics',
  'Pics',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (img src URLs)
drop policy if exists "Pics public read" on storage.objects;
create policy "Pics public read"
  on storage.objects for select
  to public
  using (bucket_id = 'Pics');

-- Upload under {user_id}/...
drop policy if exists "Pics authenticated upload" on storage.objects;
create policy "Pics authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'Pics'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Pics authenticated update" on storage.objects;
create policy "Pics authenticated update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'Pics'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Pics authenticated delete" on storage.objects;
create policy "Pics authenticated delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'Pics'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
