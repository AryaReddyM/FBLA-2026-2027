-- Staff (teachers) can now add items to the inventory and edit the items they
-- added (owner request, Oct 28, 2026). Admins and managers keep full control.
-- Retiring, marking lost and deleting stay admin/manager-only, enforced by the
-- trigger below because RLS can't restrict which columns change.

drop policy "assets: admins and managers insert" on public.assets;
drop policy "assets: admins and managers update" on public.assets;

create policy "assets: admins, managers and staff insert"
  on public.assets for insert to authenticated
  with check (
    (select public.has_any_role(array['admin', 'manager', 'staff']::public.user_role[]))
    -- created_by defaults to the signed-in user; staff can't pretend to be someone else.
    and (created_by = (select auth.uid()) or (select public.has_any_role(array['admin', 'manager']::public.user_role[])))
  );

create policy "assets: admins and managers update all, staff update their own"
  on public.assets for update to authenticated
  using (
    (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
    or ((select public.current_user_role()) = 'staff' and created_by = (select auth.uid()))
  )
  with check (
    (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
    or ((select public.current_user_role()) = 'staff' and created_by = (select auth.uid()))
  );

-- What staff may NOT do to an item, even one they added.
create or replace function public.protect_asset_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.current_user_role() = 'staff' then
    if new.status is distinct from old.status and new.status in ('retired', 'lost') then
      raise exception 'Only admins and managers can retire items or mark them lost.' using errcode = '42501';
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'Only admins can delete items.' using errcode = '42501';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'The person who added an item can''t be changed.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_asset_changes
  before update on public.assets
  for each row execute function public.protect_asset_changes();

drop policy "licenses: admins and managers insert" on public.digital_licenses;
drop policy "licenses: admins and managers update" on public.digital_licenses;

create policy "licenses: admins and managers, or staff for their own items, insert"
  on public.digital_licenses for insert to authenticated
  with check (
    (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
    or (
      (select public.current_user_role()) = 'staff'
      and exists (select 1 from public.assets a where a.id = asset_id and a.created_by = (select auth.uid()))
    )
  );

create policy "licenses: admins and managers, or staff for their own items, update"
  on public.digital_licenses for update to authenticated
  using (
    (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
    or (
      (select public.current_user_role()) = 'staff'
      and exists (select 1 from public.assets a where a.id = asset_id and a.created_by = (select auth.uid()))
    )
  )
  with check (
    (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
    or (
      (select public.current_user_role()) = 'staff'
      and exists (select 1 from public.assets a where a.id = asset_id and a.created_by = (select auth.uid()))
    )
  );

-- Photos: staff may add photos to items they added (folder = asset id).
create policy "asset photos: staff upload for their own items"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'asset-photos'
    and (select public.current_user_role()) = 'staff'
    and exists (
      select 1 from public.assets a
       where a.id::text = (storage.foldername(name))[1] and a.created_by = (select auth.uid())
    )
  );

create policy "asset photos: staff remove for their own items"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'asset-photos'
    and (select public.current_user_role()) = 'staff'
    and exists (
      select 1 from public.assets a
       where a.id::text = (storage.foldername(name))[1] and a.created_by = (select auth.uid())
    )
  );
