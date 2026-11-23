// Why this exists: the link at the bottom of every email. Opening it only
// shows a button, because mail scanners open links on their own; the button,
// or a mail app's one-click unsubscribe, turns the daily and weekly emails off.
import type { APIRoute } from "astro";
import { readUnsubscribeToken } from "../../../server/email.ts";
import { env } from "../../../server/env.ts";
import { adminClient } from "../../../server/supabase.ts";

export const prerender = false;

const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Emails</title></head><body>${body}</body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );

const BAD = page(
  '<h1>This link does not work</h1><p>Turn the emails off on your <a href="/account/settings/">account settings</a>.</p>',
  400,
);

export const GET: APIRoute = ({ url }) => {
  const token = url.searchParams.get("t");
  if (!readUnsubscribeToken(env.unsubscribeKey(), token)) return BAD;
  const action = `/api/email/unsubscribe/?t=${encodeURIComponent(token ?? "")}`;
  return page(
    `<h1>Turn off our emails?</h1><p>This stops the daily exercise email and the weekly email.</p><form method="post" action="${action}"><button type="submit">Turn off emails</button></form><p><a href="/">Back to the site</a></p>`,
  );
};

export const POST: APIRoute = async ({ url }) => {
  const userId = readUnsubscribeToken(env.unsubscribeKey(), url.searchParams.get("t"));
  if (!userId) return BAD;
  const { error } = await adminClient()
    .from("profiles")
    .update({ daily: false, digest: false })
    .eq("id", userId);
  if (error)
    return page(
      "<h1>The emails are still on</h1><p>The change could not be saved. Try again in a minute.</p>",
      500,
    );
  return page(
    '<h1>The emails are off</h1><p>You will not get them any more. To turn one back on, use your <a href="/account/settings/">account settings</a>.</p>',
  );
};
