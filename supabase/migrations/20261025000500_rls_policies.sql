-- Row Level Security: the real enforcement of the role permissions table.
-- The UI hides buttons too, but a user calling the API directly still hits these.
--
-- Policies call current_user_role() wrapped in (select ...). Postgres then runs
-- it once per query instead of once per row, which keeps big tables fast.
--
-- Anonymous (logged-out) visitors get no policies at all, so they see nothing.

alter table public.profiles enable row level security;
alter table public.institution_settings enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.assets enable row level security;
alter table public.digital_licenses enable row level security;
alter table public.checkouts enable row level security;
alter table public.audit_log enable row level security;
alter table public.report_runs enable row level security;
alter table public.metric_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- profiles: everyone signed in can see names (needed for "checked out by"),
-- you can edit your own name, admins can edit anyone. Role changes are further
-- restricted by the protect_profile_columns trigger.
create policy "profiles: signed-in users can read"
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) is not null or id = (select auth.uid()));

create policy "profiles: update self or admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.current_user_role()) = 'admin')
  with check (id = (select auth.uid()) or (select public.current_user_role()) = 'admin');

-- institution_settings: read by all, changed by admins only.
create policy "settings: signed-in users can read"
  on public.institution_settings for select to authenticated
  using ((select public.current_user_role()) is not null);

create policy "settings: admins update"
  on public.institution_settings for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- categories & locations: read by all, managed by admins.
create policy "categories: signed-in users can read"
  on public.categories for select to authenticated
  using ((select public.current_user_role()) is not null);

create policy "categories: admins insert"
  on public.categories for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "categories: admins update"
  on public.categories for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "categories: admins delete"
  on public.categories for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

create policy "locations: signed-in users can read"
  on public.locations for select to authenticated
  using ((select public.current_user_role()) is not null);

create policy "locations: admins insert"
  on public.locations for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy "locations: admins update"
  on public.locations for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy "locations: admins delete"
  on public.locations for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- assets: everyone reads; admins and managers register, edit, retire.
-- There is deliberately no DELETE policy: assets are soft-deleted (deleted_at)
-- so history and past reports stay accurate.
create policy "assets: signed-in users can read"
  on public.assets for select to authenticated
  using ((select public.current_user_role()) is not null);

create policy "assets: admins and managers insert"
  on public.assets for insert to authenticated
  with check ((select public.has_any_role(array['admin', 'manager']::public.user_role[])));

create policy "assets: admins and managers update"
  on public.assets for update to authenticated
  using ((select public.has_any_role(array['admin', 'manager']::public.user_role[])))
  with check ((select public.has_any_role(array['admin', 'manager']::public.user_role[])));

create policy "licenses: signed-in users can read"
  on public.digital_licenses for select to authenticated
  using ((select public.current_user_role()) is not null);

create policy "licenses: admins and managers insert"
  on public.digital_licenses for insert to authenticated
  with check ((select public.has_any_role(array['admin', 'manager']::public.user_role[])));

create policy "licenses: admins and managers update"
  on public.digital_licenses for update to authenticated
  using ((select public.has_any_role(array['admin', 'manager']::public.user_role[])))
  with check ((select public.has_any_role(array['admin', 'manager']::public.user_role[])));

-- checkouts: readable by all signed-in staff (the desk needs to see who has
-- what). No insert/update policies: the only way to create or close a loan is
-- through check_out_asset / check_in_asset, which validate and lock first.
create policy "checkouts: signed-in users can read"
  on public.checkouts for select to authenticated
  using ((select public.current_user_role()) is not null);

-- audit_log: admins and managers read. No insert/update/delete policies at
-- all, so it is append-only from the app's point of view; the SECURITY
-- DEFINER audit trigger is the only writer.
create policy "audit: admins and managers read"
  on public.audit_log for select to authenticated
  using ((select public.has_any_role(array['admin', 'manager']::public.user_role[])));

-- report_runs: admins/managers see all runs; staff see their own. Staff may
-- only run the checkout activity report (scoped to their own loans by the app).
create policy "reports: read own or all for admins and managers"
  on public.report_runs for select to authenticated
  using (
    generated_by = (select auth.uid())
    or (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
  );

create policy "reports: insert own runs"
  on public.report_runs for insert to authenticated
  with check (
    generated_by = (select auth.uid())
    and (
      (select public.has_any_role(array['admin', 'manager']::public.user_role[]))
      or ((select public.current_user_role()) = 'staff' and report_type = 'checkout_activity')
    )
  );

-- metric_events: anyone signed in can log their own timing; admins read.
create policy "metrics: insert own"
  on public.metric_events for insert to authenticated
  with check (actor_id = (select auth.uid()) and (select public.current_user_role()) is not null);

create policy "metrics: admins read"
  on public.metric_events for select to authenticated
  using ((select public.current_user_role()) = 'admin');
