// Buying PRO without an account, against fake Stripe and Supabase: checkout
// starts as a guest, the webhook gives PRO to the account for the paid email,
// and the success link signs in only an account made for this purchase, once.
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query } from "./fake-supabase.ts";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const created = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const m = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  handler: (() => ({ data: null, error: null })) as Handler,
  log: [] as Query[],
  // Supabase auth admin
  authUser: { id: "u-1", created_at: "", last_sign_in_at: null as string | null },
  verifyOtp: vi.fn(),
  signInWithOtp: vi.fn(),
  // Stripe
  sessionsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
  subsUpdate: vi.fn(),
  subsRetrieve: vi.fn(),
  event: null as unknown,
}));

vi.mock("./supabase.ts", () => {
  const db = () => fakeClient((q) => m.handler(q), m.log);
  return {
    currentUser: async () => ({ supabase: db(), user: m.user }),
    adminClient: () => ({
      ...db(),
      auth: {
        admin: {
          createUser: async () => ({ data: null, error: null }),
          generateLink: async () => ({
            data: { user: m.authUser, properties: { hashed_token: "hash-1" } },
            error: null,
          }),
        },
      },
    }),
    userClient: () => ({ auth: { verifyOtp: m.verifyOtp, signInWithOtp: m.signInWithOtp } }),
    markSignedIn: () => {},
  };
});
vi.mock("./events.ts", () => ({ logEvent: async () => {} }));
vi.mock("./env.ts", () => ({ env: { stripeWebhookSecret: () => "whsec" } }));
vi.mock("./plans.ts", () => ({
  offeredPlans: () => [{ key: "monthly" }, { key: "lifetime" }],
  priceIdFor: (k: string) => `price_${k}`,
}));
vi.mock("./stripe.ts", () => ({
  stripe: () => ({
    prices: {
      retrieve: async (id: string) => ({
        type: id === "price_lifetime" ? "one_time" : "recurring",
      }),
    },
    checkout: { sessions: { create: m.sessionsCreate, retrieve: m.sessionsRetrieve } },
    subscriptions: { update: m.subsUpdate, retrieve: m.subsRetrieve },
    webhooks: { constructEventAsync: async () => m.event },
  }),
}));

const checkout = await import("../pages/api/stripe/checkout.ts");
const claim = await import("../pages/api/stripe/claim.ts");
const webhook = await import("../pages/api/stripe/webhook.ts");

const ctx = (url: string, init?: RequestInit) =>
  ({
    request: new Request(url, init),
    url: new URL(url),
    cookies: {},
  }) as unknown as APIContext;
const post = (fields: Record<string, string>) =>
  ctx("http://localhost/api/stripe/checkout/", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
const location = (r: Response) => r.headers.get("location") ?? "";

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  m.user = null;
  m.handler = () => ({ data: null, error: null });
  m.log.length = 0;
  m.authUser = { id: "u-1", created_at: created(30_000), last_sign_in_at: null };
  for (const f of [
    m.verifyOtp,
    m.signInWithOtp,
    m.sessionsCreate,
    m.sessionsRetrieve,
    m.subsUpdate,
  ])
    f.mockReset();
  m.verifyOtp.mockResolvedValue({ error: null });
  m.signInWithOtp.mockResolvedValue({ error: null });
  m.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  m.subsRetrieve.mockResolvedValue({
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    current_period_end: NOW / 1000 + 86_400,
    items: { data: [] },
    metadata: { user_id: "u-1" },
  });
});

describe("checkout as a guest", () => {
  it("starts Stripe Checkout with no customer and the claim link", async () => {
    const res = await checkout.POST(post({ plan: "monthly" }));
    expect(location(res)).toBe("https://checkout.stripe.test/s");
    const args = m.sessionsCreate.mock.calls[0]?.[0];
    expect(args.customer).toBeUndefined();
    expect(args.mode).toBe("subscription");
    expect(args.success_url).toBe(
      "http://localhost/api/stripe/claim/?session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("makes a Stripe customer for a guest lifetime payment", async () => {
    await checkout.POST(post({ plan: "lifetime" }));
    expect(m.sessionsCreate.mock.calls[0]?.[0]).toMatchObject({
      mode: "payment",
      customer_creation: "always",
    });
  });

  it("sends Continue with Google through sign-in and back with the plan", async () => {
    const res = await checkout.POST(post({ plan: "monthly", via: "google" }));
    expect(location(res)).toBe(
      `/api/auth/google/?next=${encodeURIComponent("/api/stripe/checkout/?plan=monthly")}`,
    );
    expect(m.sessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a plan that is not on sale", async () => {
    const res = await checkout.GET(ctx("http://localhost/api/stripe/checkout/?plan=semiannual"));
    expect(location(res)).toContain("/pricing/?error=");
  });
});

describe("webhook for a guest checkout", () => {
  it("links the paid email's account, tags the subscription and saves PRO", async () => {
    m.event = {
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: null,
          customer: "cus_1",
          subscription: "sub_1",
          created: NOW / 1000,
          customer_details: { email: "buyer@example.com" },
        },
      },
    };
    const res = await webhook.POST({
      request: new Request("http://localhost/", {
        method: "POST",
        headers: { "stripe-signature": "s" },
        body: "{}",
      }),
    } as unknown as APIContext);
    expect(res.status).toBe(200);
    expect(m.subsUpdate).toHaveBeenCalledWith("sub_1", { metadata: { user_id: "u-1" } });
    const updates = m.log.filter((q) => q.table === "profiles" && q.op === "update");
    expect(updates[0]).toMatchObject({
      payload: { stripe_customer_id: "cus_1" },
      filters: { id: "u-1" },
    });
    expect(updates.at(-1)?.filters).toEqual({ id: "u-1" });
  });
});

describe("claim link", () => {
  const paid = (over: Record<string, unknown> = {}) => ({
    status: "complete",
    client_reference_id: null,
    created: NOW / 1000 - 60,
    customer_details: { email: "buyer@example.com" },
    ...over,
  });
  const open = (id = "cs_test_1") =>
    claim.GET(ctx(`http://localhost/api/stripe/claim/?session_id=${id}`));

  it("signs in an account made for this purchase", async () => {
    m.sessionsRetrieve.mockResolvedValue(paid());
    const res = await open();
    expect(m.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "magiclink" });
    expect(location(res)).toBe("/subscribe/?ok=1&new=1");
    expect(m.log).toContainEqual(
      expect.objectContaining({
        table: "checkout_claims",
        op: "insert",
        payload: { session_id: "cs_test_1" },
      }),
    );
  });

  it("only emails a link to an account that existed before", async () => {
    m.sessionsRetrieve.mockResolvedValue(paid());
    m.authUser = { id: "u-1", created_at: created(-86_400_000), last_sign_in_at: null };
    const res = await open();
    expect(m.verifyOtp).not.toHaveBeenCalled();
    expect(m.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "buyer@example.com" }),
    );
    expect(location(res)).toContain("/login/?ok=");
  });

  it("does not sign in an account that has signed in before", async () => {
    m.sessionsRetrieve.mockResolvedValue(paid());
    m.authUser = { id: "u-1", created_at: created(30_000), last_sign_in_at: created(40_000) };
    await open();
    expect(m.verifyOtp).not.toHaveBeenCalled();
  });

  it("works once", async () => {
    m.sessionsRetrieve.mockResolvedValue(paid());
    m.handler = (q) =>
      q.table === "checkout_claims"
        ? { data: null, error: { code: "23505" } }
        : { data: null, error: null };
    const res = await open();
    expect(m.verifyOtp).not.toHaveBeenCalled();
    expect(location(res)).toContain("/login/?ok=");
  });

  it("expires after an hour", async () => {
    m.sessionsRetrieve.mockResolvedValue(paid({ created: NOW / 1000 - 2 * 3600 }));
    const res = await open();
    expect(m.verifyOtp).not.toHaveBeenCalled();
    expect(m.log.some((q) => q.table === "checkout_claims")).toBe(false);
    expect(location(res)).toContain("/login/?ok=");
  });

  it("refuses an unpaid, signed-in or made-up session", async () => {
    for (const s of [paid({ status: "open" }), paid({ client_reference_id: "u-9" })]) {
      m.sessionsRetrieve.mockResolvedValue(s);
      expect(location(await open())).toContain("/pricing/?error=");
    }
    expect(location(await open("not-a-session"))).toContain("/pricing/?error=");
    expect(m.verifyOtp).not.toHaveBeenCalled();
  });
});
