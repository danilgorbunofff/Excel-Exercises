# Launch on Vercel

The pages are a static Astro build. The `@astrojs/vercel` adapter writes them
to `dist/client` and turns `src/pages/api/*` (accounts, progress sync, Stripe)
into one Vercel Function. Vercel applies `vercel.json`: the redirects from the
old `/topics/` and `/pro/` addresses, the security headers and long caching for
the hashed files in `/_astro/`.

## Owner steps before the first deploy

1. **Choose the domain** and set `url` in `site.config.ts` to it, for example
   `https://excelexercises.online`, with no trailing slash. Canonical links,
   share previews, `sitemap.xml` and `robots.txt` are built from it.
   `npm run build && npm run check:origin` must pass. CI runs that check on
   every push to `main`, so main fails until the placeholder is gone.
2. **If the site name changes**, set `name` in `site.config.ts`, then run
   `npm run share-images` to remake `public/og.png` and
   `public/apple-touch-icon.png`, and commit both images.
3. **Create the Vercel project** from the GitHub repository:
   - Framework preset: Astro
   - Build command: `npm run build && npm run check:csp && npm run check:origin`.
     Vercel deploys `main` without waiting for CI, so these two checks stop a
     build with stale Content-Security-Policy hashes or the placeholder domain.
   - Output directory: leave empty. The adapter writes `.vercel/output`, which
     Vercel uses as it is.
   - Install command: the default (`npm install`), or `npm ci`
   - Node.js version: 24 (Project Settings, Build and Deployment)
   - Environment variables: see "Accounts and PRO" below.
4. **Add the domain** in Project Settings, Domains, and follow Vercel's DNS
   instructions. Add the `www` form too and let Vercel redirect it to the main
   domain.
5. **Set `contactEmail`** in `site.config.ts`. While it is `null`, the footer
   links to the contact page and its form stays disabled.
6. **Terms and privacy.** `/terms/` and `/privacy/` were written without a
   lawyer. Have them reviewed before you take payments or open accounts. The
   privacy page names Vercel, Supabase and Stripe. The terms do not yet say
   whether you give refunds: decide, and add it.

## Accounts and PRO

Accounts use Supabase (Auth and Postgres). PRO is a Stripe subscription, or a one-time lifetime payment while the launch offer runs.

### Environment variables (Vercel, Production and Preview)

| Name                                                                                             | From                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                 | The Supabase integration sets these. `src/server/env.ts` also accepts the `NEXT_PUBLIC_*`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` names.                                                                                                                |
| `STRIPE_SECRET_KEY`                                                                              | Stripe, Developers, API keys. Production gets live keys; add test-mode keys and test price ids to Preview, or previews show no prices and checkout fails.                                                                                                             |
| `STRIPE_WEBHOOK_SECRET`                                                                          | The webhook endpoint below.                                                                                                                                                                                                                                           |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME` | The price ids (`price_...`) of the PRO product, listed in `src/server/plans.ts`. Checkout reads from Stripe whether each is recurring (a subscription) or one-time (lifetime). On a build with Stripe keys, an unset `STRIPE_PRICE_LIFETIME` hides the lifetime plan. |
| `STRIPE_PRICE_SEMIANNUAL` (optional)                                                             | The retired 6-month price. Not sold any more and not needed: access and billing for existing 6-month members follow their Stripe subscription, not this variable.                                                                                                     |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                                   | Resend, for the opt-in weekly email. `EMAIL_FROM` is the sender, such as `Excel Exercises <hello@excelexercises.online>`, on a domain verified in Resend (it asks for DNS records).                                                                                   |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (optional)                                                  | DeepSeek, for the formula fixer (`/api/fix-formula/`). `DEEPSEEK_MODEL` defaults to `deepseek-flash`. Run `supabase/migrations/0008_ai_usage.sql` first: it holds the monthly fix counts.                                                                             |
| `CRON_SECRET`                                                                                    | Any long random string. Vercel sends it with the weekly cron call (`crons` in `vercel.json`); `/api/cron/weekly/` refuses calls without it.                                                                                                                           |

For local work: `vercel link`, then `vercel env pull .env.local`.

### Supabase

1. Run `supabase/migrations/0001_accounts.sql` once, in the SQL editor or with
   `supabase db push`. It creates `profiles` and `progress` with row-level
   security, and a profile for every new user.
   Then run `supabase/migrations/0002_assessments.sql` the same way. It creates
   `assessment_attempts`, where `/api/assessments/` keeps mock assessment results.
   Then run `supabase/migrations/0003_daily.sql`. It creates `daily_solves`,
   where `/api/daily/` keeps the days a user solved the daily exercise.
   Then run `supabase/migrations/0004_certificates.sql`. It creates
   `certificates`, adds the stored formulas and server times to
   `assessment_attempts`, and stops the browser from writing attempts itself:
   from then on only `/api/assessments/` (service role) saves them. Deploy the
   code and run 0004 together, since older code saves attempts as the user.
   Then run `supabase/migrations/0005_events.sql` (anonymous usage counts,
   see `docs/metrics.md`) and `0006_digest.sql` (the weekly email switch).
   Deploy the code and run 0006 together: the account page reads `digest`.
2. Authentication, URL Configuration: Site URL `https://excelexercises.online`.
   Redirect URLs: `https://excelexercises.online/api/auth/callback/**`,
   `http://localhost:4321/api/auth/callback/**` and your preview domain.
3. Authentication, Providers: turn on Google with a Google Cloud OAuth client.
   Its redirect URI is the one Supabase shows on that page.
4. Authentication, Emails: the confirmation email must show the code
   `{{ .Token }}` as well as the link, because `/verify/` asks for the code.
5. Authentication, SMTP: set your own sender (for example Resend). The built-in
   sender allows only a few emails an hour.

### Stripe

1. A product "PRO" with these prices:

   | Plan           | Price | Billing                   | Variable                 |
   | -------------- | ----- | ------------------------- | ------------------------ |
   | Monthly        | $15   | recurring, every month    | `STRIPE_PRICE_MONTHLY`   |
   | Every 3 months | $29   | recurring, every 3 months | `STRIPE_PRICE_QUARTERLY` |
   | Yearly         | $59   | recurring, every year     | `STRIPE_PRICE_ANNUAL`    |
   | Lifetime       | $129  | one-time, launch offer    | `STRIPE_PRICE_LIFETIME`  |

   No free trial on any price.
2. Developers, Webhooks: endpoint `https://excelexercises.online/api/stripe/webhook/`
   with `checkout.session.completed`, `checkout.session.async_payment_succeeded`
   and `customer.subscription.created`, `.updated` and `.deleted`. Copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Settings, Billing, Customer portal: turn it on, and allow cancelling and
   switching between the monthly, 3-month and yearly prices. Do not add the old
   6-month price as a switch target; members on it can still cancel.
4. The pricing page reads the prices at build time. Redeploy after you change
   a price.

### Pricing change checklist (owner only)

Code is done; these steps are in Stripe and Vercel, in this order:

1. Stripe, Product catalogue, product "PRO": create the four prices in the table
   above.
2. Archive the old $9 monthly and $39 6-month prices (Archive, not delete).
   Archived prices stop new sales; existing subscriptions on them keep renewing
   and keep their price.
3. Vercel, Settings, Environment Variables, Preview and Production: set
   `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_QUARTERLY`, `STRIPE_PRICE_ANNUAL` and
   `STRIPE_PRICE_LIFETIME` to the new price ids (Preview with test-mode ids and
   a test-mode `STRIPE_SECRET_KEY`). `STRIPE_PRICE_SEMIANNUAL` can be removed:
   the code no longer needs it. Redeploy.
4. Stripe, Settings, Adaptive Pricing: turn it on, so buyers see prices in their
   local currency. Then turn on Stripe Tax (Settings, Tax) or set up VAT
   another way, and check the Checkout page shows tax before you go live.
5. Test in test mode: buy each plan, check PRO appears on the account page, and
   that the lifetime payment shows "never renews or ends".

### Ending the lifetime offer

Lifetime is a launch offer, so there is one switch to turn it off:

- Set `lifetimeOffer: false` in `site.config.ts` and deploy. The pricing page
  stops showing it and `/api/stripe/checkout/` refuses it, whatever
  `STRIPE_PRICE_LIFETIME` holds.
- Or remove `STRIPE_PRICE_LIFETIME` from Vercel and redeploy. On a build with Stripe
  keys that hides it too.
- Then archive the $129 price in Stripe so no old link can sell it.

People who already bought lifetime keep PRO: it is stored on their account
(`pro_status = lifetime`), not read from the price.

### What is locked

`isLocked` in `src/lib/access.ts`: exercises with `pro: true`, and every
exercise after `freeCount` in `site.config.ts` (`null` means none by count).
A locked exercise page is built without its answers and shows a paywall. A
PRO visitor's browser fetches the answers from `/api/exercises/<slug>/`.

## Keeping the security policy in step

The Content-Security-Policy in `vercel.json` allows only this site. Astro puts
a few small scripts and styles inline, so the policy lists the hash of each
one. When a component's inline script or style changes, CI fails at
"Content-Security-Policy hashes match the build". Fix it with:

```bash
npm run build && npm run csp:write
```

Then commit `vercel.json`. `tests/e2e/csp.spec.ts` loads every page with the
policy applied and fails if the browser blocks anything.

Vercel's preview toolbar loads scripts from another site, so the policy blocks
it on preview deployments. That is expected. The live site does not use it.

## After each production deploy

Replace `https://example.com` with the live domain.

1. Pages load: `/`, `/exercises/`, one exercise such as
   `/exercises/add-two-cells/`, `/functions/vlookup/`, `/articles/` and
   `/progress/`. Solve one exercise and check that the progress page counts it.
2. A missing page gives the 404 page with status 404:

   ```bash
   curl -sI https://example.com/nope | head -1
   ```

3. An old topic address returns 301 to its learning track:

   ```bash
   curl -sI https://example.com/topics/references/ | grep -iE '^(HTTP|location)'
   ```

   Expect `301` and `location: /exercises/tracks/references/`.
4. The headers are present:

   ```bash
   curl -sI https://example.com/ | grep -iE 'content-security-policy|x-content-type-options|referrer-policy|permissions-policy'
   ```

   ```bash
   curl -sI "https://example.com$(curl -s https://example.com/ | grep -o '/_astro/[^"]*\.css' | head -1)" | grep -i cache-control
   ```

   Expect `public, max-age=31536000, immutable` for the `/_astro/` file.
5. Open the browser console on the home page and on an exercise. There must be
   no Content-Security-Policy errors.
6. `https://example.com/sitemap.xml` and `https://example.com/robots.txt` use
   the live domain, and the sitemap has no private account pages such as
   `/account/`.
7. Accounts, in a private window: sign up, confirm with the code, log out, log
   in, sign in with Google, reset the password. Solve an exercise, log in in a
   second browser and check that the progress is there.
8. PRO, with Stripe test keys on a preview: open a PRO exercise and see the
   paywall, pay with card `4242 4242 4242 4242`, check that `/subscribe/` says
   PRO is active and the exercise opens. Cancel in the portal and check that
   the exercise locks again once the period ends.
9. Paste the home page address into a share preview checker and check that the
   title, description and image show.
10. Run Lighthouse on the live URL, mobile, in Chrome DevTools or with
    `npx lighthouse https://example.com/ --view`. Performance should be
    at least 90 and Accessibility, Best Practices and SEO 100, as in CI.
