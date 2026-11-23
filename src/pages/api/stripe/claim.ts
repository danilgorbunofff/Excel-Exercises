// Why this exists: where Stripe sends a guest after paying. A new account made
// for this purchase is signed in at once. Stripe does not prove the buyer owns
// the email they typed, so an account that existed before gets only a sign-in
// link in its own inbox: paying with someone else's email never opens their
// account. Each Checkout session is claimed once, within an hour.
import type { APIRoute } from "astro";
import { accountForEmail } from "../../../server/guest.ts";
import { back, redirect } from "../../../server/http.ts";
import { stripe } from "../../../server/stripe.ts";
import { adminClient, markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

const CLAIM_WINDOW_MS = 60 * 60 * 1000;

const LOG_IN = {
  ok: "Payment received. PRO is on the account for the email you paid with: log in with it.",
};

export const GET: APIRoute = async (ctx) => {
  const id = ctx.url.searchParams.get("session_id") ?? "";
  const session = /^cs_\w+$/u.test(id)
    ? await stripe()
        .checkout.sessions.retrieve(id)
        .catch(() => null)
    : null;
  const email = session?.customer_details?.email;
  if (session?.status !== "complete" || !email || session.client_reference_id)
    return back("/pricing/", { error: "That checkout link is not valid." });
  const since = session.created * 1000;
  if (Date.now() - since > CLAIM_WINDOW_MS) return back("/login/", LOG_IN);
  const { error } = await adminClient().from("checkout_claims").insert({ session_id: id });
  if (error) return back("/login/", LOG_IN);

  const supabase = userClient(ctx);
  const account = await accountForEmail(email, since);
  if (account?.isNew) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: account.tokenHash,
      type: "magiclink",
    });
    if (!error) {
      markSignedIn(ctx, true);
      return redirect("/subscribe/?ok=1&new=1");
    }
  }
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${ctx.url.origin}/api/auth/callback/?next=/account/billing/`,
    },
  });
  return back("/login/", {
    ok: "Payment received. PRO is on the account for the email you paid with. We sent a sign-in link there.",
  });
};
