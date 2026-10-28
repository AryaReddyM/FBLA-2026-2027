drop function if exists public.admin_load_demo_data(jsonb);

alter table public.institution_settings alter column name set default 'My School';
