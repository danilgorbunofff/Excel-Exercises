// Why this exists: fills the account Certificates page: the certificate list
// (certificates-view.ts), the mock assessment results from /api/assessments/,
// a claim form for a timed pass with no live certificate (certificate-offer.ts),
// and the PRO locks for a free account.
import { passes } from "../lib/certificates.ts";
import { offerCertificate } from "./certificate-offer.ts";
import { renderCertificates } from "./certificates-view.ts";
import { loadMe } from "./session.ts";

interface Attempt {
  id: string;
  assessment: string;
  started_at: string;
  finished_at: string;
  time_limit_s: number | null;
  score: number;
  total: number;
}
interface Cert {
  assessment: string;
  revoked_at: string | null;
}

const node = document.querySelector("script[data-set-titles]");
const sets: Record<string, { title: string; sample: boolean }> = node?.textContent
  ? JSON.parse(node.textContent)
  : {};
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
) => Object.assign(document.createElement(tag), props);

const getJson = async <T>(url: string): Promise<T[]> => {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    const body: unknown = res.ok ? await res.json() : [];
    return Array.isArray(body) ? (body as T[]) : [];
  } catch {
    return [];
  }
};

/** "34:12" from two ISO times. */
const used = (a: Attempt) => {
  const s = Math.max(0, Math.round((Date.parse(a.finished_at) - Date.parse(a.started_at)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function rows(attempts: Attempt[], certs: Cert[], pro: boolean): HTMLTableRowElement[] {
  const live = new Set(certs.filter((c) => !c.revoked_at).map((c) => c.assessment));
  return attempts.flatMap((a) => {
    const set = sets[a.assessment];
    const pct = Math.round((a.score / a.total) * 100);
    const tr = el("tr");
    // The pill and a claim button sit in a wrapping row, so the button drops
    // under the pill on a narrow table instead of widening the row.
    const result = el("td", { className: "res-cell" });
    const res = el("span", { className: "res" });
    result.append(res);
    const passed = passes(a.score, a.total);
    const pill = el("span", {
      className: set?.sample ? "pill" : passed ? "pill ok" : "pill bad",
      textContent: set?.sample ? "Practice run" : passed ? "Passed" : "Below 80%",
    });
    res.append(pill);
    tr.append(
      el("td", { textContent: set?.title ?? a.assessment }),
      el("td", {
        className: "muted tnum nowrap",
        textContent: new Date(a.finished_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }),
      el("td", { className: "r tnum nowrap", textContent: `${a.score} of ${a.total}, ${pct}%` }),
      el("td", { className: "r tnum muted", textContent: a.time_limit_s ? used(a) : "Untimed" }),
      result,
    );
    const claimable = pro && !set?.sample && passed && a.time_limit_s && !live.has(a.assessment);
    if (!claimable) return [tr];
    const claim = el("button", {
      type: "button",
      className: "button button-secondary sm nowrap",
      textContent: "Claim certificate",
    });
    res.append(claim);
    const formRow = el("tr", { hidden: true });
    const cell = el("td", { colSpan: 5 });
    const box = el("div", { className: "claim" });
    cell.append(box);
    formRow.append(cell);
    claim.addEventListener("click", () => {
      claim.hidden = true;
      formRow.hidden = false;
      void offerCertificate(box, {
        slug: a.assessment,
        sample: false,
        timed: true,
        saved: { id: a.id, score: a.score, total: a.total },
      });
    });
    return [tr, formRow];
  });
}

void loadMe().then(async (me) => {
  if (!me) return;
  for (const lock of document.querySelectorAll<HTMLElement>("[data-pro-lock]"))
    lock.hidden = me.pro;
  const certBox = $("[data-certs]");
  if (certBox) void renderCertificates(certBox, me.pro);
  const [attempts, certs] = await Promise.all([
    getJson<Attempt>("/api/assessments/"),
    getJson<Cert>("/api/certificates/"),
  ]);
  const body = $("[data-attempts]");
  body?.replaceChildren(...rows(attempts, certs, me.pro));
  const box = $("[data-attempts-box]");
  if (box) box.hidden = attempts.length === 0;
  const empty = $("[data-attempts-empty]");
  if (empty) empty.hidden = attempts.length > 0;
});
