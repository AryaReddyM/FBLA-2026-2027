-- Core tables. Every table gets RLS enabled in the policies migration.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.user_role not null default 'staff',
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.institution_settings (
  id uuid primary key default gen_random_uuid(),
  -- Only one row may ever exist: the unique + check pair makes a second insert fail.
  singleton boolean not null default true unique check (singleton),
  name text not null default 'Lincoln High School',
  logo_path text,
  fiscal_year_start_month smallint not null default 7 check (fiscal_year_start_month between 1 and 12),
  asset_tag_prefix text not null default 'EDU' check (asset_tag_prefix ~ '^[A-Z0-9]{2,8}$'),
  default_loan_days integer not null default 14 check (default_loan_days between 1 and 365),
  depreciation_method text not null default 'straight_line' check (depreciation_method = 'straight_line'),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

insert into public.institution_settings default values;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  kind public.asset_kind not null,
  parent_id uuid references public.categories (id) on delete set null,
  useful_life_years integer check (useful_life_years between 1 and 50),
  -- Admin-defined extra fields, e.g. [{"key":"isbn","label":"ISBN","type":"text","required":true}]
  custom_field_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_field_schema) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (kind, name)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  building text,
  room text,
  type public.location_type not null default 'classroom',
  manager_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  -- Defaults to '' so the insert can omit it; the assign_asset_tag trigger fills it in.
  asset_tag text not null default '' unique check (char_length(asset_tag) between 1 and 64),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  kind public.asset_kind not null,
  category_id uuid references public.categories (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  status public.asset_status not null default 'available',
  condition public.asset_condition,
  serial_number text,
  manufacturer text,
  model text,
  acquisition_date date,
  acquisition_cost numeric(12, 2) check (acquisition_cost >= 0),
  funding_source text,
  vendor text,
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  image_path text,
  notes text,
  -- Weighted search document: tag and name matter most, then serial/model, then description.
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, public.f_unaccent(coalesce(asset_tag, ''))), 'A') ||
    setweight(to_tsvector('english'::regconfig, public.f_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('simple'::regconfig, public.f_unaccent(
      coalesce(serial_number, '') || ' ' || coalesce(model, '') || ' ' || coalesce(manufacturer, '')
    )), 'B') ||
    setweight(to_tsvector('english'::regconfig, public.f_unaccent(coalesce(description, ''))), 'C')
  ) stored,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  retired_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- A serial number identifies one physical device, so it must be unique among live
-- assets. Soft-deleted rows are excluded so a mistake can be re-entered.
create unique index assets_serial_number_unique
  on public.assets (lower(serial_number))
  where serial_number is not null and deleted_at is null;

create index assets_category_idx on public.assets (category_id);
create index assets_location_idx on public.assets (location_id);
create index assets_status_idx on public.assets (status) where deleted_at is null;
create index assets_search_idx on public.assets using gin (search_vector);
create index assets_name_trgm_idx on public.assets using gin (lower(name) extensions.gin_trgm_ops);

create table public.digital_licenses (
  asset_id uuid primary key references public.assets (id) on delete cascade,
  -- null means unlimited (site license)
  seats_total integer check (seats_total > 0),
  license_type public.license_type not null default 'per_seat',
  billing_cycle public.billing_cycle not null default 'annual',
  cost_per_period numeric(12, 2) check (cost_per_period >= 0),
  renewal_date date,
  expires_at date,
  platform_url text,
  admin_contact text,
  contract_number text,
  -- Never store full license keys. At most the last 4 characters, as a hint.
  license_key_hint text check (char_length(license_key_hint) <= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  -- Copied from the asset so the partial unique index below can use it
  -- (an index can't look at another table).
  asset_kind public.asset_kind not null,
  borrower_type public.borrower_type not null,
  borrower_name text not null check (char_length(borrower_name) between 1 and 120),
  -- Student ID number or staff email. Nothing else about students is stored (FERPA-minded).
  borrower_ref text check (char_length(borrower_ref) <= 120),
  checked_out_by uuid references public.profiles (id) on delete set null,
  checked_out_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  returned_to uuid references public.profiles (id) on delete set null,
  condition_out public.asset_condition,
  condition_in public.asset_condition,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- The database itself guarantees a physical item can only have one open loan,
-- even if two requests race past the app's checks at the same moment.
create unique index checkouts_one_open_per_physical_asset
  on public.checkouts (asset_id)
  where returned_at is null and asset_kind = 'physical';

create index checkouts_asset_idx on public.checkouts (asset_id, checked_out_at desc);
create index checkouts_open_idx on public.checkouts (due_at) where returned_at is null;
create index checkouts_checked_out_by_idx on public.checkouts (checked_out_by);

-- Append-only history. Rows are written by triggers (see audit migration), never by app code.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'create', 'update', 'retire', 'delete', 'check_out', 'check_in', 'import', 'report_generated'
  )),
  entity text not null,
  entity_id uuid,
  -- Set for anything about a specific asset (including its checkouts) so the
  -- item detail timeline is one indexed lookup.
  asset_id uuid,
  summary text not null default '',
  changes jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_asset_idx on public.audit_log (asset_id, created_at desc) where asset_id is not null;
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'annual_inventory', 'checkout_activity', 'valuation', 'license_summary', 'audit_trail'
  )),
  params jsonb not null default '{}'::jsonb,
  format public.report_format not null,
  file_path text,
  generated_by uuid references public.profiles (id) on delete set null,
  row_count integer not null default 0,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index report_runs_created_idx on public.report_runs (created_at desc);

-- Timing samples for the "Impact" card (section 8.10): how long searches,
-- registrations and reports take, the same measures the research paper used.
create table public.metric_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('search', 'registration', 'report')),
  duration_ms integer not null check (duration_ms between 0 and 3600000),
  actor_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index metric_events_kind_idx on public.metric_events (kind, created_at desc);
