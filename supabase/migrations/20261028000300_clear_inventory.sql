-- admin_clear_inventory: "Start fresh". Removes every item, loan, license
-- record, saved report and history entry so a school can begin with an empty
-- catalog (for example, after trying the app with practice data). Accounts,
-- locations, categories and institution settings are kept.
--
-- This is the one place assets are hard-deleted instead of soft-deleted: the
-- point is to remove practice data completely, and one audit entry records
-- who did it and how many items were removed.

create or replace function public.admin_clear_inventory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_assets integer;
begin
  -- auth.uid() is null only for the service role (server scripts), which is trusted.
  if v_actor is not null and public.current_user_role() is distinct from 'admin' then
    raise exception 'Only admins can clear the inventory.' using errcode = '42501';
  end if;

  select count(*) into v_assets from public.assets;

  perform set_config('edutrack.skip_audit', 'on', true);
  delete from public.checkouts where true;
  delete from public.digital_licenses where true;
  delete from public.assets where true;
  delete from public.report_runs where true;
  delete from public.metric_events where true;
  delete from public.audit_log where true;
  perform set_config('edutrack.skip_audit', '', true);

  insert into public.audit_log (actor_id, action, entity, summary)
  values (v_actor, 'delete', 'assets', 'cleared the inventory to start fresh (' || v_assets || ' items removed)');

  return jsonb_build_object('assets_removed', v_assets);
end;
$$;

revoke execute on function public.admin_clear_inventory() from public, anon;
grant execute on function public.admin_clear_inventory() to authenticated, service_role;
