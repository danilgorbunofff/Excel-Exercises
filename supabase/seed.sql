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
