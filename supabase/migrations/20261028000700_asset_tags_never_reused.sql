-- Asset tags end up on printed QR labels stuck to real devices, so a tag must
-- never be handed out twice. The old "highest number + 1" scheme only looked at
-- the items that exist right now, so it reused numbers after Start fresh or a
-- hard delete, reused an item's old number after it was retagged, and stopped
-- working entirely if someone typed a tag with a very long number.
--
-- A sequence fixes all of these: it only ever moves forward, it isn't affected
-- by deletes, and concurrent registrations each get their own number without
-- waiting on a lock. Numbers keep counting across years (EDU-2026-000412, then
-- EDU-2027-000413), which keeps every number unique for the life of the school.

create sequence if not exists public.asset_tag_seq as bigint minvalue 1;
-- Only the security definer functions below may touch the counter.
revoke all on sequence public.asset_tag_seq from public, anon, authenticated;

-- The number part of a tag in our PREFIX-YYYY-000123 format, or null for any
-- other tag (an existing district barcode, for example). Capped at 18 digits
-- so a typo can never overflow bigint.
create or replace function public.asset_tag_number(p_tag text, p_prefix text)
returns bigint
language sql
immutable
set search_path = public
as $$
  select (regexp_match(upper(btrim(p_tag)), '^' || p_prefix || '-\d{4}-(\d{1,18})$'))[1]::bigint
$$;

create or replace function public.format_asset_tag(p_prefix text, p_number bigint)
returns text
language sql
stable
set search_path = public
as $$
  -- lpad would cut 1234567 down to 6 digits, so only pad numbers that are shorter.
  select p_prefix || '-' || to_char(now(), 'YYYY') || '-'
    || lpad(p_number::text, greatest(6, length(p_number::text)), '0')
$$;

-- Tags edited before this fix could be stored in lower case.
update public.assets
   set asset_tag = upper(btrim(asset_tag))
 where asset_tag <> upper(btrim(asset_tag));

-- Start the counter above every number already in use with the current prefix.
do $$
declare
  v_prefix text := coalesce((select asset_tag_prefix from public.institution_settings limit 1), 'EDU');
  v_max bigint;
begin
  select max(public.asset_tag_number(asset_tag, v_prefix)) into v_max from public.assets;
  if v_max is null or v_max < 1 then
    perform setval('public.asset_tag_seq', 1, false);
  else
    perform setval('public.asset_tag_seq', v_max, true);
  end if;
end;
$$;

-- Preview for the registration form ("Auto: EDU-2026-000124"). It only peeks
-- at the counter, so opening the form never uses up a number.
create or replace function public.next_asset_tag()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text := coalesce((select asset_tag_prefix from public.institution_settings limit 1), 'EDU');
  v_next bigint;
  v_tag text;
begin
  select case when is_called then last_value + 1 else last_value end into v_next from public.asset_tag_seq;
  loop
    v_tag := public.format_asset_tag(v_prefix, v_next);
    exit when not exists (select 1 from public.assets where asset_tag = v_tag);
    v_next := v_next + 1;
  end loop;
  return v_tag;
end;
$$;

-- Runs on every insert, and on updates that touch the tag. SECURITY DEFINER so
-- it can use the counter and see every tag (including soft-deleted items),
-- whoever is saving.
create or replace function public.assign_asset_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := coalesce((select asset_tag_prefix from public.institution_settings limit 1), 'EDU');
begin
  if new.asset_tag is null or btrim(new.asset_tag) = '' then
    if tg_op = 'UPDATE' then
      new.asset_tag := old.asset_tag;
      return new;
    end if;
    -- Skip any number someone already typed in by hand.
    loop
      new.asset_tag := public.format_asset_tag(v_prefix, nextval('public.asset_tag_seq'));
      exit when not exists (select 1 from public.assets where asset_tag = new.asset_tag);
    end loop;
    return new;
  end if;

  -- Typed or scanned tags are stored in one consistent form, so "edu-2026-000003"
  -- and "EDU-2026-000003" can't both exist. A typed tag doesn't move the counter:
  -- every label EduTrack printed is already below it, and one typo like
  -- EDU-2026-99999999999 would otherwise inflate every future tag.
  new.asset_tag := upper(btrim(new.asset_tag));
  return new;
end;
$$;

drop trigger if exists assign_asset_tag on public.assets;
create trigger assign_asset_tag
  before insert or update of asset_tag on public.assets
  for each row execute function public.assign_asset_tag();

revoke execute on function public.asset_tag_number(text, text) from public, anon, authenticated;
revoke execute on function public.format_asset_tag(text, bigint) from public, anon, authenticated;
revoke execute on function public.next_asset_tag() from public, anon;
grant execute on function public.next_asset_tag() to authenticated;
