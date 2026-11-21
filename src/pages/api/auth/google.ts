// Why this exists: starts "Continue with Google". Supabase keeps the PKCE
// verifier in a cookie, and /api/auth/callback/ finishes the sign-in.
import type { APIRoute } from "astro";
import { back, redirect, safePath } from "../../../server/http.ts";
import { userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const next = safePath(ctx.url.searchParams.get("next"), "/profile/");
  const { data, error } = await userClient(ctx).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${ctx.url.origin}/api/auth/callback/?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url)
    return back("/login/", { error: "Google sign-in is not available right now. Try again in a minute." });
  return redirect(data.url);
};
