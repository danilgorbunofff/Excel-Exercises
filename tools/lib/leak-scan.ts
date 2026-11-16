// Why this exists: proof for the reverification that the built site gives no
// answer away. Every PRO exercise's and every mock task's reference answer
// must be absent from the files a visitor can download, in any escaping, and
// daily-only tasks must not show up in the catalogue, search, sitemap or
// track pages.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { listFiles } from "./fs.ts";

/** The forms an answer takes in HTML, in a JSON string, or in a JS string. */
export function escapings(answer: string): string[] {
  const html = answer
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const html39 = html.replaceAll("'", "&#39;");
  const json = JSON.stringify(answer).slice(1, -1);
  const unicode = json
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
  return [...new Set([answer, html, html39, json, unicode, answer.replaceAll('"', "&#34;")])];
}

export interface Secret {
  /** Where the answer belongs, such as exercise/vlookup-exact#2. */
  owner: string;
  answer: string;
}

export interface Hit {
  owner: string;
  answer: string;
  file: string;
}

/** Every file under dir that holds one of the secrets. */
export function findLeaks(dir: string, secrets: readonly Secret[]): Hit[] {
  const files = listFiles(dir, (n) => /\.(html|js|mjs|json|xml|txt|css|map)$/u.test(n));
  const hits: Hit[] = [];
  const forms = secrets.map((s) => ({ s, forms: escapings(s.answer) }));
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const { s, forms: f } of forms)
      if (f.some((x) => text.includes(x))) hits.push({ ...s, file: relative(dir, file) });
  }
  return hits;
}

/** Files outside the daily pages that name a daily-only task's page. */
export function findDailyMentions(dir: string, slugs: readonly string[]): Hit[] {
  const files = listFiles(dir, (n) => /\.(html|json|xml)$/u.test(n)).filter(
    (f) => !relative(dir, f).startsWith("daily/"),
  );
  const hits: Hit[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const slug of slugs)
      if (text.includes(`/daily/task/${slug}/`) || text.includes(`/exercises/${slug}/`))
        hits.push({ owner: `daily/${slug}`, answer: "", file: relative(dir, file) });
  }
  return hits;
}
