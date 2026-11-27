-- Why this exists: test accounts for the LOCAL Supabase stack only
-- (`supabase start` / `supabase db reset`). Never run this against production.
-- See docs/local-supabase.md.
--
--   free@example.test / localtest123   plain account, no PRO
--   pro@example.test  / localtest123   lifetime PRO, set below without Stripe
--
-- Sign in at http://localhost:4321/login/ with either one.

create extension if not exists pgcrypto with schema extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('localtest123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"news":false}', now(), now(),
  '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'free@example.test'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'pro@example.test')
) as u (id, email);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users
where email in ('free@example.test', 'pro@example.test');

-- The on_auth_user_created trigger made both profiles. Give one PRO, as the
-- Stripe webhook would for a lifetime purchase (see src/lib/access.ts hasPro).
update public.profiles set pro_status = 'lifetime', pro_until = null
where id = '22222222-2222-2222-2222-222222222222';

-- Scoreboard learners: same password as above, <nickname>@example.test. Safe to
-- run again; in a new week it gives them fresh points for "This week".
create temp table board_seed (n int, nickname text, week int, older int);
insert into board_seed values
  (1, 'pivot_queen', 240, 1380), (2, 'vlookup_vic', 195, 745), (3, 'cell_mate', 160, 270),
  (4, 'sumif_sam', 140, 470), (5, 'index_match', 130, 130), (6, 'xl_newbie', 95, 0),
  (7, 'formula_fan', 70, 1130), (8, 'if_else_ivy', 50, 70), (9, 'lookup_lee', 30, 0),
  (10, 'sum_total', 15, 0), (11, 'count_cara', 10, 3100), (12, 'old_timer', 0, 2000);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  ('33333333-3333-3333-3333-' || lpad(n::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
  nickname || '@example.test',
  extensions.crypt('localtest123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"news":false}', now(), now(),
  '', '', '', ''
from board_seed
on conflict do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u join board_seed s on u.email = s.nickname || '@example.test'
on conflict do nothing;

update public.profiles p set nickname = s.nickname
from board_seed s join auth.users u on u.email = s.nickname || '@example.test'
where p.id = u.id and p.nickname is null;

-- One ledger row holds at most 100 points, so each total is split into rows.
insert into public.points (user_id, item, kind, day, points, created_at)
select u.id, 'seed:' || t.tag || ':' || i, 'solve', (t.at at time zone 'utc')::date,
  least(100, t.total - i * 100), t.at
from board_seed s
join auth.users u on u.email = s.nickname || '@example.test'
cross join lateral (values
  ('week:' || date_trunc('week', now() at time zone 'utc')::date, s.week, now()),
  ('older', s.older, date_trunc('week', now()) - interval '10 days')
) as t (tag, total, at)
cross join lateral generate_series(0, (t.total - 1) / 100) as i
where t.total > 0
on conflict do nothing;

drop table board_seed;
