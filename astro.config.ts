// Why this exists: Astro build settings. Static output, stable URLs that end
// in a slash, and no dev toolbar or prefetching that could add requests.
import { satteri } from "@astrojs/markdown-satteri";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";
import { siteConfig } from "./site.config.ts";
import { shapeArticle } from "./src/lib/article-html.ts";

export default defineConfig({
  site: siteConfig.url,
  // Pages stay prerendered; only src/pages/api/* runs on the server.
  output: "static",
  // The track order and the assessment sets are read at run time too
  // (/api/exercises/, /api/assessments/).
  adapter: vercel({ includeFiles: ["content/track.yaml", "content/assessments.yaml"] }),
  trailingSlash: "always",
  build: { format: "directory" },
  compressHTML: true,
  devToolbar: { enabled: false },
  prefetch: false,
  markdown: {
    processor: satteri({
      // Straight quotes and apostrophes only, as the copy linter requires.
      features: { smartPunctuation: false },
      // Formula bars, step badges and boxed notes in articles.
      hastPlugins: [
        {
          name: "article-html",
          after(root, ctx) {
            const tree = structuredClone(root);
            shapeArticle(tree);
            ctx.setField(root, "children", tree.children);
          },
        },
      ],
    }),
  },
  // Topics became learning tracks. The old /topics/ addresses get a 301 from
  // the host: see vercel.json and tools/lib/vercel-config.test.ts.
});
