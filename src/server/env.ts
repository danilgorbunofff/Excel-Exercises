// Why this exists: the one place that reads server secrets. They come from
// the Vercel project at run time (process.env), never from the build, and a
// missing one fails loudly instead of half-working. The Supabase integration
// has used more than one name for each key, so each lists the names it accepts.

import { createHmac } from "node:crypto";

function read(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing environment variable: ${names.join(" or ")}`);
}

export const env = {
  supabaseUrl: () => read("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () =>
    read("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => read("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
  stripeSecretKey: () => read("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => read("STRIPE_WEBHOOK_SECRET"),
  /** Signs mock assessment start tokens. Derived from the service key, so there is no extra secret to set. */
  assessmentStartKey: () =>
    createHmac("sha256", read("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"))
      .update("assessment-start")
      .digest("base64url"),
  // The plan price ids are read in plans.ts.
};
