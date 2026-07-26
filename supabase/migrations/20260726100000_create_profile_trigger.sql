-- ============================================================
-- Auto-create a profiles row whenever a new auth.users row is inserted.
-- security definer: runs as the function owner so it can write to
-- public.profiles regardless of the inserting role's RLS visibility.
-- ============================================================
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
