-- save_asset: create or edit an asset and (for digital assets) its license
-- details in ONE transaction, so we never end up with a digital asset that
-- has no license row because the second insert failed.
-- SECURITY INVOKER: the normal RLS insert/update policies still decide who may do this.

create or replace function public.save_asset(
  p_id uuid,
  p_asset jsonb,
  p_license jsonb default null
)
returns table (id uuid, asset_tag text)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_tag text;
  v_kind public.asset_kind;
begin
  if p_id is null then
    insert into public.assets (
      asset_tag, name, description, kind, category_id, location_id, status, condition,
      serial_number, manufacturer, model, acquisition_date, acquisition_cost,
      funding_source, vendor, notes, custom_fields
    ) values (
      coalesce(p_asset ->> 'asset_tag', ''),
      p_asset ->> 'name',
      p_asset ->> 'description',
      (p_asset ->> 'kind')::public.asset_kind,
      (p_asset ->> 'category_id')::uuid,
      (p_asset ->> 'location_id')::uuid,
      coalesce((p_asset ->> 'status')::public.asset_status, 'available'),
      (p_asset ->> 'condition')::public.asset_condition,
      p_asset ->> 'serial_number',
      p_asset ->> 'manufacturer',
      p_asset ->> 'model',
      (p_asset ->> 'acquisition_date')::date,
      (p_asset ->> 'acquisition_cost')::numeric,
      p_asset ->> 'funding_source',
      p_asset ->> 'vendor',
      p_asset ->> 'notes',
      coalesce(p_asset -> 'custom_fields', '{}'::jsonb)
    )
    returning assets.id, assets.asset_tag, assets.kind into v_id, v_tag, v_kind;
  else
    update public.assets a
       set asset_tag = coalesce(nullif(p_asset ->> 'asset_tag', ''), a.asset_tag),
           name = p_asset ->> 'name',
           description = p_asset ->> 'description',
           category_id = (p_asset ->> 'category_id')::uuid,
           location_id = (p_asset ->> 'location_id')::uuid,
           -- A checked-out item's status belongs to the circulation desk; an
           -- edit can't flip it back to "available" while someone still has it.
           status = case when a.status = 'checked_out' then a.status
                         else coalesce((p_asset ->> 'status')::public.asset_status, a.status) end,
           condition = (p_asset ->> 'condition')::public.asset_condition,
           serial_number = p_asset ->> 'serial_number',
           manufacturer = p_asset ->> 'manufacturer',
           model = p_asset ->> 'model',
           acquisition_date = (p_asset ->> 'acquisition_date')::date,
           acquisition_cost = (p_asset ->> 'acquisition_cost')::numeric,
           funding_source = p_asset ->> 'funding_source',
           vendor = p_asset ->> 'vendor',
           notes = p_asset ->> 'notes',
           custom_fields = coalesce(p_asset -> 'custom_fields', '{}'::jsonb)
     where a.id = p_id and a.deleted_at is null
    returning a.id, a.asset_tag, a.kind into v_id, v_tag, v_kind;

    if v_id is null then
      raise exception 'Item not found, or you do not have permission to edit it.' using errcode = 'P0002';
    end if;
  end if;

  if v_kind = 'digital' and p_license is not null then
    insert into public.digital_licenses (
      asset_id, seats_total, license_type, billing_cycle, cost_per_period, renewal_date,
      expires_at, platform_url, admin_contact, contract_number, license_key_hint
    ) values (
      v_id,
      (p_license ->> 'seats_total')::integer,
      coalesce((p_license ->> 'license_type')::public.license_type, 'per_seat'),
      coalesce((p_license ->> 'billing_cycle')::public.billing_cycle, 'annual'),
      (p_license ->> 'cost_per_period')::numeric,
      (p_license ->> 'renewal_date')::date,
      (p_license ->> 'expires_at')::date,
      p_license ->> 'platform_url',
      p_license ->> 'admin_contact',
      p_license ->> 'contract_number',
      p_license ->> 'license_key_hint'
    )
    on conflict (asset_id) do update set
      seats_total = excluded.seats_total,
      license_type = excluded.license_type,
      billing_cycle = excluded.billing_cycle,
      cost_per_period = excluded.cost_per_period,
      renewal_date = excluded.renewal_date,
      expires_at = excluded.expires_at,
      platform_url = excluded.platform_url,
      admin_contact = excluded.admin_contact,
      contract_number = excluded.contract_number,
      license_key_hint = excluded.license_key_hint;
  end if;

  return query select v_id, v_tag;
end;
$$;

revoke execute on function public.save_asset(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_asset(uuid, jsonb, jsonb) to authenticated;
