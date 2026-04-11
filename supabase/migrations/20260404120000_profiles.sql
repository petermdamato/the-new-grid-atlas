-- Run in Supabase SQL Editor or via supabase db push
-- Profiles: app fields keyed to auth.users; RLS restricts access to own row.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  zip_code text,
  notify_new_data_centers boolean not null default false,
  onboarding_done boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists profiles_id_idx on public.profiles (id);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant select, insert, update on public.profiles to authenticated;
