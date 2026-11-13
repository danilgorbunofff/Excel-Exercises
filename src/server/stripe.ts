// Why this exists: one Stripe client for the /api/* functions.
import Stripe from "stripe";
import { env } from "./env.ts";

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(env.stripeSecretKey());
  return client;
}
