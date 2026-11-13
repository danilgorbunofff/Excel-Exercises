// Why this exists: Astro build settings. Static output, stable URLs that end
// in a slash, and no dev toolbar or prefetching that could add requests.
import { defineConfig } from "astro/config";
import { siteConfig } from "./site.config.ts";

export default defineConfig({
  site: siteConfig.url,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  compressHTML: true,
  devToolbar: { enabled: false },
  prefetch: false,
  // Straight quotes and apostrophes only, as the copy linter requires.
  markdown: { smartypants: false },
  // Topics became learning tracks. The old /topics/ addresses get a 301 from
  // the host: see vercel.json and tools/lib/vercel-config.test.ts.
});
