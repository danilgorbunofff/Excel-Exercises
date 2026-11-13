// Why this exists: tells static pages who is signed in and on which plan.
import type { APIRoute } from "astro";
import { hasPro } from "../../lib/access.ts";
import { json } from "../../server/http.ts";
import { currentUser, markSignedIn } from "../../server/supabase.ts";

export const prerender = false;

export interface Me {
  email: string;
  pro: boolean;
  proStatus: string | null;
  proUntil: string | null;
  news: boolean;
  /** Google users have no password to change. */
  hasPassword: boolean;
}

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) {
    markSignedIn(ctx, false);
    return json({ error: "signed out" }, 401);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("pro_status, pro_until, news")
    .eq("id", user.id)
    .maybeSingle();
  const me: Me = {
    email: user.email ?? "",
    pro: hasPro(profile),
    proStatus: profile?.pro_status ?? null,
    proUntil: profile?.pro_until ?? null,
    news: profile?.news ?? false,
    hasPassword: (user.identities ?? []).some((i) => i.provider === "email"),
  };
  return json(me);
};
