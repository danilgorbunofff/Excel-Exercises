-- Why this exists: the monthly quota for the AI formula fixer. One row per
-- user and month counts the fixes asked for. Only the server (service role)
-- writes it, so a user cannot reset their own count.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  used integer not null default 0,
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;
-- Users may read their own counts (for the account export), never write them.
create policy "read own fix counts" on public.ai_usage
  for select using (auth.uid() = user_id);
grant select on public.ai_usage to authenticated;

-- Takes one fix if the user is under the limit for this month, in one
-- statement so two requests at once cannot both pass. Returns the new count,
-- or -1 when the limit is reached.
create function public.claim_ai_fix(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  if p_limit < 1 then
    return -1;
  end if;
  insert into ai_usage as u (user_id, month, used)
  values (p_user, date_trunc('month', now() at time zone 'utc')::date, 1)
  on conflict (user_id, month) do update set used = u.used + 1 where u.used < p_limit
  returning u.used into v_used;
  return coalesce(v_used, -1);
end;
$$;

-- Gives a fix back when the AI call failed, so the user is not charged for it.
create function public.release_ai_fix(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update ai_usage set used = greatest(used - 1, 0)
  where user_id = p_user and month = date_trunc('month', now() at time zone 'utc')::date;
$$;

revoke execute on function public.claim_ai_fix(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_ai_fix(uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_fix(uuid, integer) to service_role;
grant execute on function public.release_ai_fix(uuid) to service_role;
