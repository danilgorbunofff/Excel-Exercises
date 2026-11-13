# Launch on Vercel

The site is a static Astro build. Vercel serves the `dist` folder and applies
`vercel.json`: the redirect from the old `/topics/` addresses, the security
headers and long caching for the hashed files in `/_astro/`.

## Owner steps before the first deploy

1. **Choose the domain** and set `url` in `site.config.ts` to it, for example
   `https://formulapractice.com`, with no trailing slash. Canonical links,
   share previews, `sitemap.xml` and `robots.txt` are built from it.
   `npm run build && npm run check:origin` must pass. CI runs that check on
   every push to `main`, so main fails until the placeholder is gone.
2. **If the site name changes**, set `name` in `site.config.ts`, then run
   `npm run share-images` to remake `public/og.png` and
   `public/apple-touch-icon.png`, and commit both images.
3. **Create the Vercel project** from the GitHub repository:
   - Framework preset: Astro
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: the default (`npm install`), or `npm ci`
   - Node.js version: 24 (Project Settings, Build and Deployment)
   - No environment variables are needed.
4. **Add the domain** in Project Settings, Domains, and follow Vercel's DNS
   instructions. Add the `www` form too and let Vercel redirect it to the main
   domain.
5. **Set `contactEmail`** in `site.config.ts`. While it is `null`, the footer
   links to the contact page and its form stays disabled.
6. **Terms and privacy.** `/terms/` and `/privacy/` were written without a
   lawyer. Have them reviewed before you take payments or open accounts. The
   privacy page names Vercel as the host and links to its privacy policy.

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
   the live domain, and the sitemap has no account pages such as `/login/`.
7. Paste the home page address into a share preview checker and check that the
   title, description and image show.
8. Run Lighthouse on the live URL, mobile, in Chrome DevTools or with
   `npx lighthouse https://example.com/ --view`. Performance should be
   at least 90 and Accessibility, Best Practices and SEO 100, as in CI.
