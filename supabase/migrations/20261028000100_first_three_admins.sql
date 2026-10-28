-- The first THREE accounts in a project become admins (previously only the
-- first). A new school's founding team can then all manage it from day one,
-- without anyone touching SQL. Everyone after that starts as staff and an
-- admin promotes them.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'staff';
begin
  -- Two people signing up at the same moment could otherwise both be counted
  -- as "third", so new sign-ups take turns while the count is checked.
  perform pg_advisory_xact_lock(hashtext('edutrack.founding_admins'));

  if (select count(*) from public.profiles) < 3 then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  );
  return new;
end;
$$;
