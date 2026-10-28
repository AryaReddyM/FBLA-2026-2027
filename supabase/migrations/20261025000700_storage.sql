-- Photos are public-read (they are pictures of projectors, not people) so
-- they can be shown with a plain URL. Size and type limits are enforced by
-- Storage itself as well as by the upload Server Action.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('asset-photos', 'asset-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('reports', 'reports', false, 26214400, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ])
on conflict (id) do nothing;

create policy "asset photos: admins and managers upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'asset-photos'
    and (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
  );

create policy "asset photos: admins and managers replace"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'asset-photos'
    and (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
  );

create policy "asset photos: admins and managers remove"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'asset-photos'
    and (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
  );

-- Report files live under reports/<user id>/..., so the first folder name says
-- who generated it.
create policy "reports: users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.current_user_role()) is not null
  );

create policy "reports: read own files, admins and managers read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reports'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
    )
  );
