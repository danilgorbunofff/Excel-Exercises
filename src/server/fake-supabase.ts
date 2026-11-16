// Why this exists: a stand-in for the Supabase client in the API tests. Each
// query is recorded and answered by the test's own handler, so a test states
// what the database returns and then checks what the endpoint asked for.
// Only tests import it.

export interface Query {
  table: string;
  op: "select" | "insert" | "update";
  payload?: unknown;
  filters: Record<string, unknown>;
  single: boolean;
}
export interface Result {
  data: unknown;
  error: { code?: string; message?: string } | null;
}
export type Handler = (q: Query) => Result;

export function fakeClient(handler: Handler, log: Query[] = []) {
  const from = (table: string) => {
    const q: Query = { table, op: "select", filters: {}, single: false };
    const run = () => {
      log.push(q);
      return Promise.resolve(handler(q));
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      insert: (payload: unknown) => {
        q.op = "insert";
        q.payload = payload;
        return chain;
      },
      update: (payload: unknown) => {
        q.op = "update";
        q.payload = payload;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        q.filters[col] = val;
        return chain;
      },
      is: (col: string, val: unknown) => {
        q.filters[col] = val;
        return chain;
      },
      single: () => {
        q.single = true;
        return run();
      },
      maybeSingle: () => {
        q.single = true;
        return run();
      },
      // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
      then: (ok: (r: Result) => unknown, fail: (e: unknown) => unknown) => run().then(ok, fail),
    };
    return chain;
  };
  return { from };
}

export const request = (method: string, body?: unknown) =>
  new Request("http://localhost/api/x/", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
