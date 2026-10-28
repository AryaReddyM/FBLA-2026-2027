-- Same trigger as the audit log migration, plus a clear "removed the account of ..."
-- entry when an account is deleted (it used to say "updated the profile of ...").
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_action text;
  v_summary text;
  v_asset_id uuid;
  v_changes jsonb;
  v_asset record;
  v_label text;
begin
  -- Start fresh switches auditing off for its own transaction only.
  if coalesce(current_setting('edutrack.skip_audit', true), '') = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    v_changes := public.jsonb_diff(v_old, v_new);
    if v_changes is null then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := jsonb_build_object('after', v_new - 'search_vector');
  else
    v_changes := jsonb_build_object('before', v_old - 'search_vector');
  end if;

  if tg_table_name = 'assets' then
    -- Check-out/check-in already write their own, clearer entry; skip the
    -- status flip they cause on the asset row.
    if tg_op = 'UPDATE' and coalesce(current_setting('edutrack.in_circulation', true), '') = 'on' then
      return null;
    end if;

    v_asset_id := (v_row ->> 'id')::uuid;
    v_label := (v_row ->> 'name') || ' (' || (v_row ->> 'asset_tag') || ')';

    if tg_op = 'INSERT' then
      v_action := coalesce(nullif(current_setting('edutrack.audit_action', true), ''), 'create');
      v_summary := case when v_action = 'import' then 'imported ' else 'registered ' end || v_label;
    elsif tg_op = 'DELETE' then
      v_action := 'delete';
      v_summary := 'permanently deleted ' || v_label;
    elsif new.deleted_at is not null and old.deleted_at is null then
      v_action := 'delete';
      v_summary := 'deleted ' || v_label;
    elsif new.status = 'retired' and old.status <> 'retired' then
      v_action := 'retire';
      v_summary := 'retired ' || v_label;
    elsif new.status = 'lost' and old.status <> 'lost' then
      v_action := 'update';
      v_summary := 'marked ' || v_label || ' as lost';
    elsif new.location_id is distinct from old.location_id then
      v_action := 'update';
      v_summary := 'moved ' || v_label || coalesce(' to ' || (select name from public.locations where id = new.location_id), '');
    elsif new.status is distinct from old.status then
      v_action := 'update';
      v_summary := 'changed status of ' || v_label || ' to ' || replace(new.status::text, '_', ' ');
    else
      v_action := 'update';
      v_summary := 'edited ' || v_label;
    end if;

  elsif tg_table_name = 'digital_licenses' then
    -- Registering a digital asset already logs "registered ..." for the asset row.
    if tg_op = 'INSERT' then
      return null;
    end if;
    v_asset_id := (v_row ->> 'asset_id')::uuid;
    select name, asset_tag into v_asset from public.assets where id = v_asset_id;
    v_action := case when tg_op = 'DELETE' then 'delete' else 'update' end;
    v_summary := 'updated license details for ' || coalesce(v_asset.name || ' (' || v_asset.asset_tag || ')', 'a license');

  elsif tg_table_name = 'checkouts' then
    v_asset_id := (v_row ->> 'asset_id')::uuid;
    select name, asset_tag into v_asset from public.assets where id = v_asset_id;
    v_label := coalesce(v_asset.name || ' ' || v_asset.asset_tag, 'an item');

    if tg_op = 'INSERT' then
      v_action := 'check_out';
      v_summary := case when new.asset_kind = 'digital' then 'assigned a seat of ' else 'checked out ' end
        || v_label || ' to ' || public.borrower_label(new.borrower_type, new.borrower_name, new.borrower_ref);
    elsif tg_op = 'UPDATE' and new.returned_at is not null and old.returned_at is null then
      v_action := 'check_in';
      v_summary := case when new.asset_kind = 'digital' then 'released a seat of ' else 'checked in ' end
        || v_label || ' from ' || public.borrower_label(new.borrower_type, new.borrower_name, new.borrower_ref)
        || coalesce(' (condition: ' || new.condition_in::text || ')', '');
    else
      v_action := case when tg_op = 'DELETE' then 'delete' else 'update' end;
      v_summary := 'edited a loan record for ' || v_label;
    end if;

  elsif tg_table_name = 'categories' then
    v_action := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end;
    v_summary := case tg_op when 'INSERT' then 'added' when 'DELETE' then 'removed' else 'edited' end
      || ' category ' || (v_row ->> 'name');

  elsif tg_table_name = 'locations' then
    v_action := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end;
    v_summary := case tg_op when 'INSERT' then 'added' when 'DELETE' then 'removed' else 'edited' end
      || ' location ' || (v_row ->> 'name');

  elsif tg_table_name = 'profiles' then
    v_action := case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      v_summary := 'changed the role of ' || new.full_name || ' to ' || new.role::text;
    elsif tg_op = 'UPDATE' and new.is_active is distinct from old.is_active then
      v_summary := case when new.is_active then 'reactivated ' else 'deactivated ' end || new.full_name;
    elsif tg_op = 'INSERT' then
      v_summary := 'created an account for ' || new.full_name;
    elsif tg_op = 'DELETE' then
      v_summary := 'removed the account of ' || (v_row ->> 'full_name');
    else
      v_summary := 'updated the profile of ' || (v_row ->> 'full_name');
    end if;

  elsif tg_table_name = 'institution_settings' then
    v_action := 'update';
    v_summary := 'updated institution settings';

  elsif tg_table_name = 'report_runs' then
    if tg_op <> 'INSERT' then
      return null;
    end if;
    v_action := 'report_generated';
    v_summary := 'generated the ' || replace(initcap(replace(new.report_type, '_', ' ')), 'Valuation', 'Valuation & Depreciation')
      || ' report (' || upper(new.format::text) || ')';
    v_changes := jsonb_build_object('after', jsonb_build_object('params', new.params, 'row_count', new.row_count));

  else
    v_action := lower(tg_op);
    v_summary := lower(tg_op) || ' on ' || tg_table_name;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, asset_id, summary, changes)
  values (
    auth.uid(),
    v_action,
    tg_table_name,
    coalesce((v_row ->> 'id')::uuid, (v_row ->> 'asset_id')::uuid),
    v_asset_id,
    v_summary,
    v_changes
  );
  return null;
end;
$$;
