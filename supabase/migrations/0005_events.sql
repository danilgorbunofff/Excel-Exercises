-- Why this exists: anonymous usage counts. One row per event: its name, the
-- page path and a random id that lives only in one browser tab. No user id,
-- no IP, no cookie. Only the server (service role) writes or reads it; the
-- weekly job deletes rows older than 13 months. /api/events checks the name.

create table public.events (
  id bigserial primary key,
  name text not null,
  path text,
  tab text,
  created_at timestamptz not null default now()
);

create index events_name_created on public.events (name, created_at);

alter table public.events enable row level security;
-- No policies: the anon and user roles can neither read nor write.
