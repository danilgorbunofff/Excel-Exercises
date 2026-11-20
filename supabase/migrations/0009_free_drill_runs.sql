-- Why this exists: the one "10 random tasks" run a signed-in Free account gets
-- each UTC day. The server picks the ten drills and keeps them here, so a second
-- press the same day resumes the same ten, and /api/exercises/ can tell which
-- drill answers a Free account may read. Only the server (service role) writes
-- it, so a user cannot add drills to their own run.

create table public.free_drill_runs (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  slugs text[] not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.free_drill_runs enable row level security;
-- Users may read their own runs (for the account export), never write them.
create policy "read own drill runs" on public.free_drill_runs
  for select using (auth.uid() = user_id);
grant select on public.free_drill_runs to authenticated;
