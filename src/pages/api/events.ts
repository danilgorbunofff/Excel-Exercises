// Why this exists: counts what visitors do, anonymously. The browser sends an
// event name, the page path and a random id that lives only in that tab. No
// cookie is read or set and nothing goes to another site.
import type { APIRoute } from "astro";
import { cleanEvent } from "../../lib/events.ts";
import { logEvent } from "../../server/events.ts";

export const prerender = false;

const MAX_BODY = 1000;

// shortcut: no rate limit, add one if the events table fills with junk.
export const POST: APIRoute = async (ctx) => {
  const text = await ctx.request.text().catch(() => "");
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: cleanEvent refuses it below.
  }
  const event = cleanEvent(body);
  if (!event) return new Response(null, { status: 400 });
  await logEvent(event.name, event.path, event.tab);
  return new Response(null, { status: 204 });
};
