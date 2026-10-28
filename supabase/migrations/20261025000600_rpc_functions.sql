-- Remote procedure calls (called from the app with supabase.rpc()).
-- Anything that changes several rows at once lives here so it happens in one
-- transaction: it either fully succeeds or fully rolls back.

-- ---------------------------------------------------------------------------
-- check_out_asset: lend a physical item or assign a digital seat.
-- ---------------------------------------------------------------------------
create or replace function public.check_out_asset(
  p_asset_id uuid,
  p_borrower_type public.borrower_type,
  p_borrower_name text,
  p_borrower_ref text default null,
  p_due_at timestamptz default null,
  p_condition_out public.asset_condition default null,
  p_notes text default null
)
returns uuid
language plpgsql
-- SECURITY DEFINER because checkouts has no INSERT policy: this function is the
-- only door in, so it must check the caller's role itself (first line below).
security definer
set search_path = public
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_asset public.assets%rowtype;
  v_seats integer;
  v_open integer;
  v_due timestamptz;
  v_id uuid;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'staff') then
    raise exception 'You do not have permission to check out items.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_borrower_name), '') = '' then
    raise exception 'Enter who is borrowing the item.' using errcode = '22023';
  end if;
  if p_due_at is not null and p_due_at < now() - interval '1 minute' then
    raise exception 'The due date must be in the future.' using errcode = '22023';
  end if;

  -- FOR UPDATE locks this asset row until we commit. If two people try to
  -- check out the same Chromebook at the same moment, the second one waits
  -- here, then sees status = 'checked_out' and gets a friendly error.
  select * into v_asset from public.assets where id = p_asset_id and deleted_at is null for update;
  if not found then
    raise exception 'Item not found.' using errcode = 'P0002';
  end if;

  if v_asset.kind = 'physical' then
    if v_asset.status <> 'available' then
      raise exception '% is not available right now (status: %).',
        v_asset.asset_tag, replace(v_asset.status::text, '_', ' ') using errcode = 'P0001';
    end if;
  else
    if v_asset.status in ('retired', 'lost') then
      raise exception 'This license is %.', v_asset.status using errcode = 'P0001';
    end if;
    select seats_total into v_seats from public.digital_licenses where asset_id = p_asset_id;
    if v_seats is not null then
      select count(*) into v_open from public.checkouts where asset_id = p_asset_id and returned_at is null;
      if v_open >= v_seats then
        raise exception 'All % seats of % are assigned. Release a seat first.', v_seats, v_asset.name
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Physical loans default to the school's loan length; digital seats have
  -- no due date unless one is given.
  v_due := coalesce(
    p_due_at,
    case when v_asset.kind = 'physical' then
      date_trunc('day', now()) + make_interval(days => coalesce(
        (select default_loan_days from public.institution_settings limit 1), 14
      )) + interval '23 hours 59 minutes'
    end
  );

  insert into public.checkouts (
    asset_id, asset_kind, borrower_type, borrower_name, borrower_ref,
    checked_out_by, due_at, condition_out, notes
  ) values (
    p_asset_id, v_asset.kind, p_borrower_type, btrim(p_borrower_name), nullif(btrim(p_borrower_ref), ''),
    auth.uid(), v_due, coalesce(p_condition_out, v_asset.condition), nullif(btrim(p_notes), '')
  ) returning id into v_id;

  if v_asset.kind = 'physical' then
    -- Tell the audit trigger not to log this status flip separately.
    perform set_config('edutrack.in_circulation', 'on', true);
    update public.assets set status = 'checked_out' where id = p_asset_id;
    perform set_config('edutrack.in_circulation', '', true);
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_asset: close a loan / release a seat.
-- ---------------------------------------------------------------------------
create or replace function public.check_in_asset(
  p_checkout_id uuid,
  p_condition_in public.asset_condition default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_checkout public.checkouts%rowtype;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'staff') then
    raise exception 'You do not have permission to check in items.' using errcode = '42501';
  end if;

  select * into v_checkout from public.checkouts where id = p_checkout_id for update;
  if not found then
    raise exception 'Loan record not found.' using errcode = 'P0002';
  end if;
  if v_checkout.returned_at is not null then
    raise exception 'This item was already checked in.' using errcode = 'P0001';
  end if;

  -- Lock the asset too, in the same order as check_out_asset (asset after
  -- checkout here is fine because check-out never locks a checkout row).
  perform 1 from public.assets where id = v_checkout.asset_id for update;

  update public.checkouts
     set returned_at = now(),
         returned_to = auth.uid(),
         condition_in = p_condition_in,
         notes = case
           when nullif(btrim(p_notes), '') is null then notes
           when notes is null then btrim(p_notes)
           else notes || E'\n' || btrim(p_notes)
         end
   where id = p_checkout_id;

  if v_checkout.asset_kind = 'physical' then
    perform set_config('edutrack.in_circulation', 'on', true);
    update public.assets
       set status = case when p_condition_in = 'broken' then 'in_repair'::public.asset_status else 'available'::public.asset_status end,
           condition = coalesce(p_condition_in, condition)
     where id = v_checkout.asset_id;
    perform set_config('edutrack.in_circulation', '', true);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- search_assets: catalog + global search with filters, sorting and paging.
-- SECURITY INVOKER (the default), so the caller's RLS policies still apply.
-- ---------------------------------------------------------------------------
create or replace function public.search_assets(
  q text default '',
  filters jsonb default '{}'::jsonb,
  page integer default 1,
  page_size integer default 25,
  sort text default 'relevance',
  dir text default 'asc'
)
returns table (
  id uuid,
  asset_tag text,
  name text,
  kind public.asset_kind,
  status public.asset_status,
  condition public.asset_condition,
  category_id uuid,
  category_name text,
  location_id uuid,
  location_name text,
  serial_number text,
  manufacturer text,
  model text,
  acquisition_date date,
  acquisition_cost numeric,
  funding_source text,
  image_path text,
  holder text,
  due_at timestamptz,
  seats_total integer,
  seats_used integer,
  rank real,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_q text := btrim(coalesce(q, ''));
  v_filters jsonb := coalesce(filters, '{}'::jsonb);
  v_like text;
  v_web_tsq tsquery;
  v_prefix_tsq tsquery;
  v_page integer := greatest(coalesce(page, 1), 1);
  v_size integer := least(greatest(coalesce(page_size, 25), 1), 200);
  v_sort text := coalesce(sort, 'relevance');
  v_desc boolean := lower(coalesce(dir, 'asc')) = 'desc';
begin
  if v_q <> '' then
    -- Escape LIKE wildcards so a search for "100%" means the literal text.
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    -- Full words, with English stemming ("projectors" finds "projector").
    v_web_tsq := websearch_to_tsquery('english', public.f_unaccent(v_q));
    -- Every word as a prefix, so results appear while someone is still typing ("chrom").
    select to_tsquery('simple', string_agg(quote_literal(lexeme) || ':*', ' & '))
      into v_prefix_tsq
      from unnest(tsvector_to_array(to_tsvector('simple', public.f_unaccent(v_q)))) as lexeme;
  elsif v_sort = 'relevance' then
    v_sort := 'asset_tag';
  end if;

  return query
  with base as (
    select a.*,
      -- Ranking: an exact tag/serial hit (someone scanned or typed a label)
      -- always wins; then full-text relevance; then fuzzy name similarity
      -- to catch typos like "chromebok".
      (case when v_q = '' then 0 else
          (case when lower(a.asset_tag) = lower(v_q) or lower(coalesce(a.serial_number, '')) = lower(v_q) then 10 else 0 end)
          + coalesce(ts_rank_cd(a.search_vector, v_web_tsq), 0) * 2
          + coalesce(ts_rank_cd(a.search_vector, v_prefix_tsq), 0)
          + similarity(lower(a.name), lower(v_q))
       end)::real as score
    from public.assets a
    where a.deleted_at is null
      and (
        v_q = ''
        or a.search_vector @@ v_web_tsq
        or (v_prefix_tsq is not null and a.search_vector @@ v_prefix_tsq)
        or a.asset_tag ilike v_like
        or a.serial_number ilike v_like
        or a.model ilike v_like
        or a.name ilike v_like
        or lower(a.name) % lower(v_q)
      )
      and (v_filters ->> 'kind' is null or a.kind::text = v_filters ->> 'kind')
      and (v_filters ->> 'status' is null or a.status::text = v_filters ->> 'status')
      and (v_filters ->> 'condition' is null or a.condition::text = v_filters ->> 'condition')
      and (v_filters ->> 'location_id' is null or a.location_id = (v_filters ->> 'location_id')::uuid)
      -- Picking a parent category ("Technology") includes its subcategories.
      and (v_filters ->> 'category_id' is null or a.category_id in (
        select c.id from public.categories c
         where c.id = (v_filters ->> 'category_id')::uuid or c.parent_id = (v_filters ->> 'category_id')::uuid
      ))
      and (v_filters ->> 'year' is null or extract(year from a.acquisition_date)::integer = (v_filters ->> 'year')::integer)
      and (v_filters ->> 'funding_source' is null or a.funding_source = v_filters ->> 'funding_source')
  )
  select
    b.id, b.asset_tag, b.name, b.kind, b.status, b.condition,
    b.category_id, c.name, b.location_id, l.name,
    b.serial_number, b.manufacturer, b.model, b.acquisition_date, b.acquisition_cost::numeric,
    b.funding_source, b.image_path,
    h.holder, h.due_at, dl.seats_total, coalesce(su.used, 0)::integer,
    b.score,
    count(*) over ()
  from base b
  left join public.categories c on c.id = b.category_id
  left join public.locations l on l.id = b.location_id
  left join public.digital_licenses dl on dl.asset_id = b.id
  left join lateral (
    select public.borrower_label(co.borrower_type, co.borrower_name, co.borrower_ref) as holder, co.due_at
      from public.checkouts co
     where co.asset_id = b.id and co.returned_at is null and b.kind = 'physical'
     order by co.checked_out_at desc
     limit 1
  ) h on true
  left join lateral (
    select count(*) as used
      from public.checkouts co
     where co.asset_id = b.id and co.returned_at is null and b.kind = 'digital'
  ) su on true
  -- Only whitelisted sort keys are possible: each is its own CASE, so user
  -- input never becomes SQL text.
  order by
    case when v_sort = 'relevance' then b.score end desc nulls last,
    case when v_sort = 'asset_tag' and not v_desc then b.asset_tag end asc,
    case when v_sort = 'asset_tag' and v_desc then b.asset_tag end desc,
    case when v_sort = 'name' and not v_desc then lower(b.name) end asc,
    case when v_sort = 'name' and v_desc then lower(b.name) end desc,
    case when v_sort = 'kind' and not v_desc then b.kind end asc,
    case when v_sort = 'kind' and v_desc then b.kind end desc,
    case when v_sort = 'category' and not v_desc then c.name end asc,
    case when v_sort = 'category' and v_desc then c.name end desc,
    case when v_sort = 'location' and not v_desc then l.name end asc,
    case when v_sort = 'location' and v_desc then l.name end desc,
    case when v_sort = 'status' and not v_desc then b.status end asc,
    case when v_sort = 'status' and v_desc then b.status end desc,
    case when v_sort = 'condition' and not v_desc then b.condition end asc,
    case when v_sort = 'condition' and v_desc then b.condition end desc,
    case when v_sort = 'acquisition_date' and not v_desc then b.acquisition_date end asc,
    case when v_sort = 'acquisition_date' and v_desc then b.acquisition_date end desc,
    case when v_sort = 'acquisition_cost' and not v_desc then b.acquisition_cost end asc,
    case when v_sort = 'acquisition_cost' and v_desc then b.acquisition_cost end desc,
    case when v_sort = 'holder' and not v_desc then h.holder end asc,
    case when v_sort = 'holder' and v_desc then h.holder end desc,
    b.asset_tag asc
  limit v_size
  offset (v_page - 1) * v_size;
end;
$$;

-- ---------------------------------------------------------------------------
-- find_possible_duplicates: warn before registering the same thing twice.
-- ---------------------------------------------------------------------------
create or replace function public.find_possible_duplicates(
  p_serial text default null,
  p_name text default null,
  p_model text default null,
  p_exclude_id uuid default null
)
returns table (
  id uuid,
  asset_tag text,
  name text,
  model text,
  serial_number text,
  reason text,
  score real
)
language sql
stable
set search_path = public, extensions
as $$
  select * from (
    -- Same serial number = almost certainly the same device.
    select a.id, a.asset_tag, a.name, a.model, a.serial_number, 'serial'::text as reason, 1::real as score
      from public.assets a
     where a.deleted_at is null
       and nullif(btrim(p_serial), '') is not null
       and lower(a.serial_number) = lower(btrim(p_serial))
       and (p_exclude_id is null or a.id <> p_exclude_id)
    union all
    -- Very similar name + model (trigram similarity above 0.6). Skipped when
    -- both items have serial numbers: different serials mean different
    -- devices, which is exactly the "30 identical Chromebooks" batch case.
    select a.id, a.asset_tag, a.name, a.model, a.serial_number, 'similar'::text,
           similarity(lower(a.name || ' ' || coalesce(a.model, '')), lower(btrim(p_name) || ' ' || coalesce(btrim(p_model), '')))
      from public.assets a
     where a.deleted_at is null
       and nullif(btrim(p_name), '') is not null
       and (p_exclude_id is null or a.id <> p_exclude_id)
       and (nullif(btrim(p_serial), '') is null or a.serial_number is null)
       and similarity(lower(a.name || ' ' || coalesce(a.model, '')), lower(btrim(p_name) || ' ' || coalesce(btrim(p_model), ''))) > 0.6
  ) d
  order by d.score desc
  limit 5
$$;

-- ---------------------------------------------------------------------------
-- dashboard_stats: everything the dashboard's cards and charts need, in one trip.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
set search_path = public
as $$
  with settings as (
    select coalesce((select fiscal_year_start_month from public.institution_settings limit 1), 7) as fy
  ),
  school_year as (
    -- If the school year starts in July and today is March 2027, the year began July 2026.
    select make_date(
      extract(year from current_date)::integer
        - case when extract(month from current_date)::integer >= (select fy from settings) then 0 else 1 end,
      (select fy from settings),
      1
    ) as start
  ),
  live as (
    select * from public.assets where deleted_at is null
  )
  select jsonb_build_object(
    'total_assets', (select count(*) from live where status <> 'retired'),
    'physical_assets', (select count(*) from live where status <> 'retired' and kind = 'physical'),
    'digital_assets', (select count(*) from live where status <> 'retired' and kind = 'digital'),
    'checked_out', (select count(*) from public.checkouts where returned_at is null and asset_kind = 'physical'),
    'seats_assigned', (select count(*) from public.checkouts where returned_at is null and asset_kind = 'digital'),
    'overdue', (select count(*) from public.checkouts where returned_at is null and due_at < now()),
    'licenses_expiring_30', (
      select count(*) from public.digital_licenses dl join live a on a.id = dl.asset_id
       where a.status <> 'retired'
         and coalesce(dl.renewal_date, dl.expires_at) between current_date and current_date + 30
    ),
    'total_value', (select coalesce(sum(acquisition_cost), 0) from live where status not in ('retired', 'lost')),
    'school_year_start', (select start from school_year),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n) order by t.n desc, t.name)
        from (
          select coalesce(c.name, 'Uncategorized') as name, count(*) as n
            from live a left join public.categories c on c.id = a.category_id
           where a.status <> 'retired'
           group by 1
        ) t
    ), '[]'::jsonb),
    'by_year', coalesce((
      select jsonb_agg(jsonb_build_object('year', t.y, 'count', t.n, 'value', t.v) order by t.y)
        from (
          select extract(year from acquisition_date)::integer as y, count(*) as n, coalesce(sum(acquisition_cost), 0) as v
            from live where acquisition_date is not null
           group by 1
        ) t
    ), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', t.status, 'count', t.n) order by t.status)
        from (select status, count(*) as n from live group by 1) t
    ), '[]'::jsonb),
    'checkouts_by_month', (
      select jsonb_agg(jsonb_build_object(
               'month', to_char(m, 'YYYY-MM'),
               'count', (select count(*) from public.checkouts c
                          where c.checked_out_at >= m and c.checked_out_at < m + interval '1 month')
             ) order by m)
        from generate_series(
          (select start from school_year)::timestamptz,
          (select start from school_year)::timestamptz + interval '11 months',
          interval '1 month'
        ) as m
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- import_assets: all-or-nothing CSV import. The app validates and resolves
-- category/location names to ids first; any row that still fails here rolls
-- back the whole import, so nothing is ever half-imported.
-- ---------------------------------------------------------------------------
create or replace function public.import_assets(p_rows jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  r jsonb;
  v_index integer := 0;
  v_id uuid;
begin
  if not public.has_any_role(array['admin', 'manager']::public.user_role[]) then
    raise exception 'Only admins and managers can import.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of rows.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2,000 rows at a time.' using errcode = '22023';
  end if;

  -- The audit trigger reads this to log "imported ..." instead of "registered ...".
  perform set_config('edutrack.audit_action', 'import', true);

  for r in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      insert into public.assets (
        asset_tag, name, description, kind, category_id, location_id, status, condition,
        serial_number, manufacturer, model, acquisition_date, acquisition_cost,
        funding_source, vendor, notes, custom_fields
      ) values (
        coalesce(r ->> 'asset_tag', ''),
        r ->> 'name',
        nullif(r ->> 'description', ''),
        coalesce((r ->> 'kind')::public.asset_kind, 'physical'),
        (r ->> 'category_id')::uuid,
        (r ->> 'location_id')::uuid,
        coalesce((r ->> 'status')::public.asset_status, 'available'),
        (r ->> 'condition')::public.asset_condition,
        nullif(r ->> 'serial_number', ''),
        nullif(r ->> 'manufacturer', ''),
        nullif(r ->> 'model', ''),
        (r ->> 'acquisition_date')::date,
        (r ->> 'acquisition_cost')::numeric,
        nullif(r ->> 'funding_source', ''),
        nullif(r ->> 'vendor', ''),
        nullif(r ->> 'notes', ''),
        coalesce(r -> 'custom_fields', '{}'::jsonb)
      ) returning id into v_id;

      if r ->> 'kind' = 'digital' then
        insert into public.digital_licenses (asset_id, seats_total, renewal_date, cost_per_period)
        values (v_id, (r ->> 'seats_total')::integer, (r ->> 'renewal_date')::date, (r ->> 'cost_per_period')::numeric);
      end if;
    exception when others then
      raise exception 'Row %: %', v_index, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  perform set_config('edutrack.audit_action', '', true);
  return v_index;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_load_demo_data: wipe inventory data and load a fresh demo data set.
-- Only the service role (seed script / admin reset button on the server) may
-- call this; it is revoked from every signed-in user below.
-- ---------------------------------------------------------------------------
create or replace function public.admin_load_demo_data(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('edutrack.skip_audit', 'on', true);

  delete from public.audit_log where true;
  delete from public.report_runs where true;
  delete from public.metric_events where true;
  delete from public.checkouts where true;
  delete from public.digital_licenses where true;
  delete from public.assets where true;
  delete from public.locations where true;
  delete from public.categories where true;

  update public.institution_settings
     set name = coalesce(p -> 'settings' ->> 'name', name),
         asset_tag_prefix = coalesce(p -> 'settings' ->> 'asset_tag_prefix', asset_tag_prefix),
         default_loan_days = coalesce((p -> 'settings' ->> 'default_loan_days')::integer, default_loan_days),
         fiscal_year_start_month = coalesce((p -> 'settings' ->> 'fiscal_year_start_month')::smallint, fiscal_year_start_month)
   where true;

  insert into public.categories (id, name, kind, parent_id, useful_life_years, custom_field_schema)
  select id, name, kind, parent_id, useful_life_years, coalesce(custom_field_schema, '[]'::jsonb)
    from jsonb_populate_recordset(null::public.categories, p -> 'categories');

  insert into public.locations (id, name, building, room, type, manager_id)
  select id, name, building, room, coalesce(type, 'classroom'), manager_id
    from jsonb_populate_recordset(null::public.locations, p -> 'locations');

  insert into public.assets (
    id, asset_tag, name, description, kind, category_id, location_id, status, condition,
    serial_number, manufacturer, model, acquisition_date, acquisition_cost, funding_source,
    vendor, custom_fields, notes, created_by, created_at
  )
  select id, asset_tag, name, description, kind, category_id, location_id, coalesce(status, 'available'), condition,
         serial_number, manufacturer, model, acquisition_date, acquisition_cost, funding_source,
         vendor, coalesce(custom_fields, '{}'::jsonb), notes, created_by, coalesce(created_at, now())
    from jsonb_populate_recordset(null::public.assets, p -> 'assets');

  insert into public.digital_licenses (
    asset_id, seats_total, license_type, billing_cycle, cost_per_period, renewal_date,
    expires_at, platform_url, admin_contact, contract_number, license_key_hint
  )
  select asset_id, seats_total, coalesce(license_type, 'per_seat'), coalesce(billing_cycle, 'annual'), cost_per_period,
         renewal_date, expires_at, platform_url, admin_contact, contract_number, license_key_hint
    from jsonb_populate_recordset(null::public.digital_licenses, p -> 'licenses');

  insert into public.checkouts (
    id, asset_id, asset_kind, borrower_type, borrower_name, borrower_ref, checked_out_by,
    checked_out_at, due_at, returned_at, returned_to, condition_out, condition_in, notes, created_at
  )
  select c.id, c.asset_id, a.kind, c.borrower_type, c.borrower_name, c.borrower_ref, c.checked_out_by,
         c.checked_out_at, c.due_at, c.returned_at, c.returned_to, c.condition_out, c.condition_in, c.notes, c.checked_out_at
    from jsonb_populate_recordset(null::public.checkouts, p -> 'checkouts') c
    join public.assets a on a.id = c.asset_id;

  -- Make asset status agree with open loans, whatever the generator produced.
  update public.assets a
     set status = 'checked_out'
   where a.kind = 'physical'
     and a.status = 'available'
     and exists (select 1 from public.checkouts c where c.asset_id = a.id and c.returned_at is null);

  -- Recreate a believable history so the dashboard's activity feed and the
  -- item timelines aren't empty on day one.
  insert into public.audit_log (actor_id, action, entity, entity_id, asset_id, summary, created_at)
  select a.created_by, 'create', 'assets', a.id, a.id,
         'registered ' || a.name || ' (' || a.asset_tag || ')', a.created_at
    from public.assets a
  union all
  select c.checked_out_by, 'check_out', 'checkouts', c.id, c.asset_id,
         case when c.asset_kind = 'digital' then 'assigned a seat of ' else 'checked out ' end
           || a.name || ' ' || a.asset_tag || ' to ' || public.borrower_label(c.borrower_type, c.borrower_name, c.borrower_ref),
         c.checked_out_at
    from public.checkouts c join public.assets a on a.id = c.asset_id
  union all
  select c.returned_to, 'check_in', 'checkouts', c.id, c.asset_id,
         case when c.asset_kind = 'digital' then 'released a seat of ' else 'checked in ' end
           || a.name || ' ' || a.asset_tag || ' from ' || public.borrower_label(c.borrower_type, c.borrower_name, c.borrower_ref)
           || coalesce(' (condition: ' || c.condition_in::text || ')', ''),
         c.returned_at
    from public.checkouts c join public.assets a on a.id = c.asset_id
   where c.returned_at is not null;

  return jsonb_build_object(
    'categories', (select count(*) from public.categories),
    'locations', (select count(*) from public.locations),
    'assets', (select count(*) from public.assets),
    'checkouts', (select count(*) from public.checkouts)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges. Logged-out visitors can call nothing; the demo loader
-- is for the service role only.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.admin_load_demo_data(jsonb) from authenticated;
