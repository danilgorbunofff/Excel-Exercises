// Why this exists: lists every public page for search engines. Static pages
// are found from the file system, and track, exercise, function and article
// pages from the content, so a new page cannot be left out by hand. Account
// pages stay out while accounts are closed.
import type { APIRoute } from "astro";
import { siteConfig } from "../../site.config.ts";
import { allArticles, articlePath } from "../lib/articles.ts";
import { exercisePath, loadTrack, placedExercises, topicPath } from "../lib/exercises.ts";
import { functionPages, functionPath } from "../lib/functions.ts";
import { hiddenFromSearch, routesFromPageFiles } from "../lib/routes.ts";

const pageFiles = Object.keys(import.meta.glob("./**/*.astro"));

export const GET: APIRoute = async ({ site }) => {
  const exercises = (await placedExercises()).map((p) => exercisePath(p.exercise.slug));
  const topics = loadTrack().topics.map((t) => topicPath(t.slug));
  const functions = (await functionPages()).map((f) => functionPath(f.slug));
  const articles = (await allArticles()).map((a) => articlePath(a.id));
  const pages = routesFromPageFiles(pageFiles).filter(
    (p) => !hiddenFromSearch(p, siteConfig.accountsOpen),
  );
  const urls = [...pages, ...topics, ...exercises, ...functions, ...articles]
    .map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
};
