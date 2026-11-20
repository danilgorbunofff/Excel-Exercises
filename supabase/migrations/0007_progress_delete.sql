-- Why this exists: "Clear my progress" on the progress page must clear the
-- account's copy too, or the next sync brings it back. A user may delete
-- only their own progress rows.

create policy "own progress: delete" on public.progress
  for delete using (auth.uid() = user_id);

-- When the progress was last cleared, so another signed-in device drops its
-- older local copy on its next sync instead of sending it back. Only the
-- DELETE endpoint sets it, as the user.
alter table public.profiles add column progress_cleared_at timestamptz;

grant update (news, digest, progress_cleared_at) on public.profiles to authenticated;
