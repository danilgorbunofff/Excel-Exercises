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
  digest: boolean;
  /** Wants the daily exercise email. */
  daily?: boolean;
  /** Has answered whether they want the daily email (sign-up checkbox, card or settings). */
  dailyAsked?: boolean;
  /** Google users have no password to change. */
  hasPassword: boolean;
  /** When the account was made (ISO), for "Member since" on the profile. */
  createdAt?: string;
}

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) {
    markSignedIn(ctx, false);
    return json({ error: "signed out" }, 401);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("pro_status, pro_until, news, digest, daily")
    .eq("id", user.id)
    .maybeSingle();
  const me: Me = {
    email: user.email ?? "",
    pro: hasPro(profile),
    proStatus: profile?.pro_status ?? null,
    proUntil: profile?.pro_until ?? null,
    news: profile?.news ?? false,
    digest: profile?.digest ?? false,
    daily: profile?.daily ?? false,
    dailyAsked: user.user_metadata?.["daily"] !== undefined,
    hasPassword: (user.identities ?? []).some((i) => i.provider === "email"),
    createdAt: user.created_at,
  };
  return json(me);
};
