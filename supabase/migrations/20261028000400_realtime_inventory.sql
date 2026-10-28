-- Lets open pages hear about changes made on other devices (see live-refresh.tsx).
-- Realtime still applies RLS, so each browser only hears about rows it may read.
do $$
declare
  t text;
begin
  foreach t in array array['assets', 'checkouts', 'digital_licenses', 'categories', 'locations', 'institution_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
