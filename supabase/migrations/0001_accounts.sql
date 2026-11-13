-- Why this exists: the account tables. A profile per user holds the PRO
-- subscription state, written only by the Stripe webhook with the service
-- role. Progress mirrors the browser's progress so it follows the user.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  pro_status text,
  pro_until timestamptz,
  news boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  entry jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.profiles enable row level security;
alter table public.progress enable row level security;

-- A user reads their own profile and may change only the email opt-in.
create policy "own profile: read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile: update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated;
grant update (news) on public.profiles to authenticated;

create policy "own progress: read" on public.progress
  for select using (auth.uid() = user_id);
create policy "own progress: insert" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "own progress: update" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every new user gets a profile. The sign-up form passes the email opt-in as user metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, news)
  values (new.id, coalesce((new.raw_user_meta_data ->> 'news')::boolean, false));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
