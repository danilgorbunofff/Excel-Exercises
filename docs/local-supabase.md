# Local Supabase for signed-in testing

A local Supabase stack (Docker via Colima) with the repo's migrations and two
test accounts, so `npm run dev` can sign in without touching production.

## Accounts

Defined in `supabase/seed.sql` (password and emails are there):

- `free@example.test`: plain account.
- `pro@example.test`: lifetime PRO, set in the seed, no Stripe.

Sign in at http://localhost:4321/login/ with the email form. Google sign-in
does not work locally (it needs a real Google client).

## Start

```bash
colima start
supabase start
npm run dev
```

`npm run dev` loads `.env.local` (Node `--env-file-if-exists`), because Astro
dev does not put `.env` values into `process.env`. If a dev server was already
running before `.env.local` existed, restart it.

`.env.local` (git-ignored) holds `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` for the local stack. Recreate it with:

```bash
supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)='
```

and rename the keys to `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Stripe, Resend and cron keys stay unset, so
checkout and email are off locally.

## Ports

This project runs on 563xx so it does not clash with other local Supabase
projects on 543xx/553xx: API http://127.0.0.1:56321, DB 56322,
Studio http://127.0.0.1:56323, Mailpit (auth emails) http://127.0.0.1:56324.
Analytics is off in `supabase/config.toml` because it fails under Colima.

## Stop

```bash
supabase stop
```

Data is kept. `colima stop` frees the VM too.

## Reset

Drops all local data, re-applies `supabase/migrations/` and `supabase/seed.sql`:

```bash
supabase db reset
```

## Turn PRO on or off for a user

Open Studio's SQL editor (http://127.0.0.1:56323) or run
`psql postgresql://postgres:postgres@127.0.0.1:56322/postgres`:

```sql
-- PRO on (as the Stripe webhook writes for a lifetime purchase)
update public.profiles set pro_status = 'lifetime', pro_until = null
where id = (select id from auth.users where email = 'free@example.test');

-- PRO off
update public.profiles set pro_status = null, pro_until = null
where id = (select id from auth.users where email = 'free@example.test');
```

Reload the page after the change. PRO rules are in `src/lib/access.ts`
(`hasPro`).
