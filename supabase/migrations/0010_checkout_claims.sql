-- Why this exists: a visitor can buy PRO without an account. Stripe's success
-- link signs the buyer in to the account made for their email, and each
-- Checkout session may do that one time only. Only the server (service role)
-- reads or writes it.

create table public.checkout_claims (
  session_id text primary key,
  claimed_at timestamptz not null default now()
);

alter table public.checkout_claims enable row level security;
