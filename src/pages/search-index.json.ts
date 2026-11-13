// Why this exists: the small index the header search box fetches on focus.
import type { APIRoute } from "astro";
import { searchItems } from "../lib/search-items.ts";

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await searchItems()), {
    headers: { "Content-Type": "application/json" },
  });
