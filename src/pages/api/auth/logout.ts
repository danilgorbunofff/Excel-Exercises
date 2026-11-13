// Why this exists: signs out and clears the session cookies.
import type { APIRoute } from "astro";
import { redirect } from "../../../server/http.ts";
import { markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  await userClient(ctx).auth.signOut();
  markSignedIn(ctx, false);
  return redirect("/");
};
