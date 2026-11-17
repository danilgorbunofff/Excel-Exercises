-- Why this exists: the opt-in weekly email (solves this week and exercises due
-- for review). Off by default; a user turns it on from the account page and
-- off there or from the unsubscribe link in every email.

alter table public.profiles add column digest boolean not null default false;

grant update (news, digest) on public.profiles to authenticated;
