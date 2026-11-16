-- Why this exists: certificates for passed mock assessments, and the attempt
-- fields the server needs to issue one honestly. From now on only the server
-- writes attempts: it grades the formulas itself and stamps the start and the
-- receipt time, so a stored score and time are never the browser's word.
-- A certificate is issued only by POST /api/certificates/ with the service
-- role; the owner can read theirs and revoke one. The public page reads a
-- certificate through the server, which selects only the public fields.
-- Deleting the account removes the attempts and the certificates.

alter table public.assessment_attempts
  -- The formula typed for each task, in task order. Null on attempts saved before 0004.
  add column formulas jsonb,
  -- When the server handed out the start token; null when the start was not verified.
  add column server_started_at timestamptz,
  -- When the server received the finished attempt.
  add column received_at timestamptz not null default now();

drop policy "own attempts: insert" on public.assessment_attempts;

create table public.certificates (
  -- 16 random bytes as base64url: unguessable, not the user id, not sequential.
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  assessment text not null,
  -- The set's title when issued, so a later rename does not change the certificate.
  assessment_title text not null,
  -- The name the user typed when they claimed it.
  name text not null check (char_length(name) between 1 and 80),
  score integer not null,
  total integer not null,
  time_limit_s integer not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (total > 0 and score between 0 and total)
);

-- One live certificate per user and set.
create unique index certificates_live on public.certificates (user_id, assessment)
  where revoked_at is null;
create index certificates_user on public.certificates (user_id, issued_at desc);

alter table public.certificates enable row level security;

-- No insert policy: only the issuing endpoint, with the service role, inserts.
create policy "own certificates: read" on public.certificates
  for select using (auth.uid() = user_id);
create policy "own certificates: revoke" on public.certificates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke update on public.certificates from authenticated;
grant update (revoked_at) on public.certificates to authenticated;
