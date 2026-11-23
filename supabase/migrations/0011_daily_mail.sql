-- Why this exists: the opt-in daily exercise email. Off by default; the sign-up
-- checkbox, the one-time card on /account/ or the settings page turns it on,
-- and the unsubscribe link in every email turns it off. mail_log keeps one row
-- per person and mail kind (for example daily:2026-11-23), so a retried or
-- doubled cron run never sends the same mail twice. The `news` column stays
-- but nothing reads it any more.

alter table public.profiles add column daily boolean not null default false;

grant update (news, digest, daily) on public.profiles to authenticated;

create table public.mail_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);

-- Only the service role (the cron job) writes it; a user may read their own
-- rows, for the data export.
alter table public.mail_log enable row level security;
create policy "own mail log: read" on public.mail_log
  for select using (auth.uid() = user_id);

-- Every new user gets a profile. The sign-up form passes the email opt-ins as user metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, news, daily)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'news')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'daily')::boolean, false)
  );
  return new;
end;
$$;
