-- pg_trgm gives us fuzzy "did you mean" matching (similarity()) for search and
-- duplicate detection. unaccent lets "Jose" match "José".
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.user_role as enum ('admin', 'manager', 'staff', 'viewer');
create type public.asset_kind as enum ('physical', 'digital');
create type public.asset_status as enum ('available', 'checked_out', 'in_repair', 'retired', 'lost');
create type public.asset_condition as enum ('new', 'good', 'fair', 'poor', 'broken');
create type public.borrower_type as enum ('student', 'staff', 'classroom');
create type public.location_type as enum ('classroom', 'library', 'office', 'storage', 'lab', 'other');
create type public.license_type as enum ('per_seat', 'site', 'subscription');
create type public.billing_cycle as enum ('monthly', 'annual', 'multi_year', 'one_time');
create type public.report_format as enum ('pdf', 'xlsx', 'csv');

-- unaccent() is only STABLE (its dictionary could change), so Postgres won't let
-- us use it inside a generated column. Pinning the dictionary makes the result
-- predictable, which is what lets us mark this wrapper IMMUTABLE.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = public, extensions
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;
