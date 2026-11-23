-- Why this exists: handle_new_user is a security definer trigger function, and
-- Postgres grants EXECUTE on new functions to everyone, so the Supabase
-- security advisor lists it as callable through /rest/v1/rpc/. Only the
-- trigger on auth.users runs it; a trigger fires without that grant.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
