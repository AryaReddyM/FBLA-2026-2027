create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'institution_settings', 'categories', 'locations', 'assets',
    'digital_licenses', 'checkouts', 'report_runs', 'metric_events'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- Used inside RLS policies. SECURITY DEFINER lets it read profiles without
-- tripping the profiles table's own RLS (which would recurse). Inactive users
-- get NULL, so every policy treats them as having no access at all.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.has_any_role(roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any (roles), false)
$$;

-- Profiles: one row per auth user, created automatically on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'staff';
begin
  -- The very first account in a fresh project becomes the admin, so a new
  -- school can bootstrap itself without touching SQL. Everyone after that
  -- starts as staff and an admin promotes them.
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync if someone changes their login email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- RLS decides *which rows* a user may update, but not *which columns*. A
-- teacher may edit their own name, so this trigger stops them from also
-- promoting themselves to admin.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    -- auth.uid() is null for the service role (setup scripts), which is trusted.
    if auth.uid() is not null and public.current_user_role() is distinct from 'admin' then
      raise exception 'Only an admin can change roles or deactivate accounts.' using errcode = '42501';
    end if;

    -- Never leave the school without an admin who can fix things.
    if old.role = 'admin' and old.is_active
       and (new.role <> 'admin' or not new.is_active)
       and (select count(*) from public.profiles where role = 'admin' and is_active and id <> old.id) = 0 then
      raise exception 'There must be at least one active admin.' using errcode = 'P0001';
    end if;
  end if;

  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Email is managed by the sign-in system.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Asset tags: PREFIX-YYYY-000123
create or replace function public.next_asset_tag()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_year text := to_char(now(), 'YYYY');
  v_next integer;
begin
  select asset_tag_prefix into v_prefix from public.institution_settings limit 1;
  v_prefix := coalesce(v_prefix, 'EDU');

  -- The prefix is restricted to A-Z/0-9 by a check constraint, so it is safe
  -- inside the regular expression.
  select coalesce(max((regexp_match(asset_tag, '^' || v_prefix || '-' || v_year || '-(\d+)$'))[1]::integer), 0) + 1
    into v_next
    from public.assets
   where asset_tag like v_prefix || '-' || v_year || '-%';

  return v_prefix || '-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;

-- If an insert arrives without a tag, assign the next one. The advisory lock
-- makes concurrent registrations take turns, so two people saving at the same
-- moment can't both get EDU-2026-000124.
create or replace function public.assign_asset_tag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.asset_tag is null or btrim(new.asset_tag) = '' then
    perform pg_advisory_xact_lock(hashtext('edutrack.asset_tag'));
    new.asset_tag := public.next_asset_tag();
  else
    new.asset_tag := upper(btrim(new.asset_tag));
  end if;
  return new;
end;
$$;

create trigger assign_asset_tag
  before insert on public.assets
  for each row execute function public.assign_asset_tag();

-- Keep retired_at consistent with status no matter who changes it.
create or replace function public.track_retired_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'retired' and (tg_op = 'INSERT' or old.status <> 'retired') then
    new.retired_at := coalesce(new.retired_at, now());
  elsif new.status <> 'retired' then
    new.retired_at := null;
  end if;
  return new;
end;
$$;

create trigger track_retired_at
  before insert or update of status on public.assets
  for each row execute function public.track_retired_at();
