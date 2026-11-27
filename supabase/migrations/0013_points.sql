-- Why this exists: points, levels and the scoreboard. Every row of points is
-- one award the server made after grading the solve itself (see
-- /api/solves/), so a learner cannot write their own score. A first solve pays
-- once per item; reviews, daily exercises and streak bonuses pay once per day.
-- The scoreboard shows only people who chose a nickname.

create table public.points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  item text not null,
  kind text not null check (kind in ('solve', 'review', 'daily', 'streak', 'backfill')),
  day date not null,
  points integer not null check (points between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, item, kind, day)
);
-- A first solve, verified or carried over, pays only once per item.
create unique index points_first_solve on public.points (user_id, item)
  where kind in ('solve', 'backfill');
create index points_created on public.points (created_at);

alter table public.points enable row level security;
-- Users may read their own rows (for the account export), never write them.
create policy "read own points" on public.points
  for select using (auth.uid() = user_id);
grant select on public.points to authenticated;

-- The public name on the scoreboard. Null keeps a person off it.
alter table public.profiles add column nickname text
  check (nickname ~ '^[A-Za-z0-9_]{3,20}$');
create unique index profiles_nickname on public.profiles (lower(nickname));
grant update (news, digest, daily, nickname) on public.profiles to authenticated;

-- The top of the board since a moment (the week's Monday, or the start of
-- time), with each person's all-time total for their level.
create function public.scoreboard(p_since timestamptz, p_limit integer)
returns table (rank bigint, nickname text, points bigint, total bigint)
language sql stable security definer set search_path = '' as $$
  select rank() over (order by sum(p.points) desc), pr.nickname, sum(p.points),
    (select sum(t.points) from public.points t where t.user_id = pr.id)
  from public.points p
  join public.profiles pr on pr.id = p.user_id
  where pr.nickname is not null and p.created_at >= p_since
  group by pr.id, pr.nickname
  order by sum(p.points) desc, pr.nickname
  limit p_limit;
$$;

-- One person's points since a moment, all-time total, and the rank they hold
-- or would hold among people with a nickname. Rank is null with no points.
create function public.scoreboard_me(p_user uuid, p_since timestamptz)
returns table (points bigint, total bigint, rank bigint)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select coalesce(sum(points) filter (where created_at >= p_since), 0) as points,
      coalesce(sum(points), 0) as total
    from public.points where user_id = p_user
  ), others as (
    select sum(p.points) as points
    from public.points p join public.profiles pr on pr.id = p.user_id
    where pr.nickname is not null and p.created_at >= p_since and p.user_id <> p_user
    group by p.user_id
  )
  select mine.points, mine.total,
    case when mine.points > 0
      then 1 + (select count(*) from others where others.points > mine.points) end
  from mine;
$$;

revoke execute on function public.scoreboard(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.scoreboard_me(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.scoreboard(timestamptz, integer) to service_role;
grant execute on function public.scoreboard_me(uuid, timestamptz) to service_role;
