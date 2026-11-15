-- Why this exists: a user's mock assessment results, one row per finished
-- attempt. Rows are written once and never changed; deleting the account
-- removes them.

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  -- Seconds, or null when the user turned the time limit off.
  time_limit_s integer,
  score integer not null,
  total integer not null,
  results jsonb not null,
  check (total > 0 and score between 0 and total),
  check (finished_at >= started_at)
);

create index assessment_attempts_user on public.assessment_attempts (user_id, finished_at desc);

alter table public.assessment_attempts enable row level security;

create policy "own attempts: read" on public.assessment_attempts
  for select using (auth.uid() = user_id);
create policy "own attempts: insert" on public.assessment_attempts
  for insert with check (auth.uid() = user_id);
