// Why this exists: renders the server-rendered pages of the built site without
// Vercel or Supabase, for the CSP check, the end-to-end tests and the preview.
// It starts a small stand-in for the Supabase REST API with three fixed
// certificates, points the server env at it, and calls the built function's
// fetch handler. Run `npm run build` first.
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ENTRY = ".vercel/output/_functions/entry.mjs";

/** Fixture certificates by id: one valid, one revoked. Any other id is unknown. */
export const CERTIFICATES: Record<string, Record<string, unknown>> = {
  ValidCertificate000001: {
    name: "Ada Lovelace",
    assessment_title: "Office essentials",
    score: 9,
    total: 10,
    time_limit_s: 1800,
    issued_at: "2026-11-15T10:21:00.000Z",
    revoked_at: null,
  },
  RevokedCertificate0001: {
    name: "Charles Babbage",
    assessment_title: "Data analyst",
    score: 8,
    total: 10,
    time_limit_s: 2400,
    issued_at: "2026-10-02T09:00:00.000Z",
    revoked_at: "2026-11-01T12:00:00.000Z",
  },
};
export const UNKNOWN_ID = "UnknownCertificate0001";
export const SSR_PATHS = [...Object.keys(CERTIFICATES), UNKNOWN_ID].map(
  (id) => `/certificates/${id}/`,
);

/** Answers GET /rest/v1/certificates?id=eq.<id> the way PostgREST does. */
async function startMockSupabase(): Promise<string> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const id = (url.searchParams.get("id") ?? "").replace(/^eq\./u, "");
    const row = url.pathname === "/rest/v1/certificates" ? CERTIFICATES[id] : undefined;
    const one = (req.headers["accept"] ?? "").includes("vnd.pgrst.object");
    res.setHeader("Content-Type", "application/json");
    if (!one) {
      res.end(JSON.stringify(row ? [row] : []));
    } else if (row) {
      res.end(JSON.stringify(row));
    } else {
      res.statusCode = 406;
      res.end(
        JSON.stringify({ code: "PGRST116", details: "The result contains 0 rows", message: "" }),
      );
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  server.unref();
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock Supabase did not start");
  return `http://127.0.0.1:${address.port}`;
}

let handler: Promise<{ fetch: (r: Request) => Promise<Response> }> | null = null;

/** The built server's fetch handler, talking to the mock Supabase. */
export function ssrHandler() {
  handler ??= (async () => {
    if (!existsSync(ENTRY)) throw new Error(`No ${ENTRY}. Run \`npm run build\` first.`);
    process.env["SUPABASE_URL"] = await startMockSupabase();
    process.env["SUPABASE_ANON_KEY"] = "mock-anon-key";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-key";
    const mod = (await import(pathToFileURL(resolve(ENTRY)).href)) as {
      default: { fetch: (r: Request) => Promise<Response> };
    };
    return mod.default;
  })();
  return handler;
}

/** True for the paths only the server renders. */
export const isSsrPath = (path: string) => path.startsWith("/certificates/");

/** The HTML of each fixture page, for the CSP hashes. */
export async function ssrPages(origin = "http://localhost"): Promise<string[]> {
  const { fetch } = await ssrHandler();
  return Promise.all(SSR_PATHS.map(async (p) => (await fetch(new Request(origin + p))).text()));
}
