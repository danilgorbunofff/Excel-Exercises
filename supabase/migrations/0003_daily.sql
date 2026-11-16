-- Why this exists: the days a user solved the daily exercise, one row per day,
-- for the personal streak. Rows are written once and never changed; a second
-- device solving the same day adds nothing. Deleting the account removes them.

create table public.daily_solves (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  exercise text not null,
  solved_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_solves enable row level security;

create policy "own daily solves: read" on public.daily_solves
  for select using (auth.uid() = user_id);
create policy "own daily solves: insert" on public.daily_solves
  for insert with check (auth.uid() = user_id);
