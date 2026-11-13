// Why this exists: the Supabase clients for the /api/* functions. The user
// client keeps the session in httpOnly cookies and acts as the user, so the
// database's row-level security applies. The admin client skips that and is
// only for the Stripe webhook and account deletion.
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { APIContext } from "astro";
import { env } from "./env.ts";

/** Not secret: it only tells static pages to ask /api/me who is signed in. */
export const SIGNED_IN_COOKIE = "signed_in";

export function userClient(ctx: Pick<APIContext, "request" | "cookies">) {
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { flowType: "pkce" },
    cookies: {
      getAll: () =>
        parseCookieHeader(ctx.request.headers.get("cookie") ?? "").map((c) => ({
          name: c.name,
          value: c.value ?? "",
        })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          ctx.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
          });
        }
      },
    },
  });
}

export function adminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sets or clears the hint cookie that static pages read. */
export function markSignedIn(ctx: Pick<APIContext, "cookies">, signedIn: boolean): void {
  if (signedIn) {
    ctx.cookies.set(SIGNED_IN_COOKIE, "1", {
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 400,
    });
  } else {
    ctx.cookies.delete(SIGNED_IN_COOKIE, { path: "/" });
  }
}

/** The signed-in user, checked with Supabase, or null. */
export async function currentUser(ctx: Pick<APIContext, "request" | "cookies">) {
  const supabase = userClient(ctx);
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
