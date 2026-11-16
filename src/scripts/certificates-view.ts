// Why this exists: the Certificates card on the account page. It lists the
// user's certificates with their public link, copies the link, and revokes
// one after an inline confirm. Revoking is done by /api/certificates/, and the
// public page then says Revoked.
import { certificatePath } from "../lib/certificates.ts";

export interface CertificateRow {
  id: string;
  name: string;
  assessment_title: string;
  score: number;
  total: number;
  issued_at: string;
  revoked_at: string | null;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
) => Object.assign(document.createElement(tag), props);

function row(cert: CertificateRow): HTMLLIElement {
  const li = el("li");
  const url = new URL(certificatePath(cert.id), document.baseURI).href;
  const title = el("p", { className: "cert-name" });
  title.append(el("a", { href: certificatePath(cert.id), textContent: cert.assessment_title }));
  const facts = el("p", {
    className: "small",
    textContent: `${cert.name}, ${cert.score} of ${cert.total}, ${day(cert.issued_at)}, `,
  });
  const status = el("span", {
    className: cert.revoked_at ? "cert-revoked" : "",
    textContent: cert.revoked_at ? `revoked on ${day(cert.revoked_at)}` : "valid",
  });
  facts.append(status);
  const note = el("p", { className: "small" });
  note.setAttribute("role", "status");
  const actions = el("div", { className: "cert-actions" });

  const copy = el("button", {
    type: "button",
    className: "button button-outline",
    textContent: "Copy link",
  });
  copy.setAttribute("aria-label", `Copy link to the ${cert.assessment_title} certificate`);
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      note.textContent = "Link copied.";
    } catch {
      note.textContent = `Copy did not work. The link is ${url}`;
    }
  });

  const showActions = () => {
    actions.replaceChildren(copy);
    if (!cert.revoked_at) actions.append(revoke);
  };
  const revoke = el("button", {
    type: "button",
    className: "button button-outline",
    textContent: "Revoke",
  });
  revoke.setAttribute("aria-label", `Revoke the ${cert.assessment_title} certificate`);
  revoke.addEventListener("click", () => {
    const yes = el("button", {
      type: "button",
      className: "button button-primary",
      textContent: "Revoke",
    });
    const keep = el("button", {
      type: "button",
      className: "button button-outline",
      textContent: "Keep",
    });
    note.textContent = "Revoke it? Its link will then say Revoked. This cannot be undone.";
    actions.replaceChildren(yes, keep);
    keep.addEventListener("click", () => {
      note.textContent = "";
      showActions();
      revoke.focus();
    });
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      try {
        const res = await fetch("/api/certificates/", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cert.id }),
        });
        if (!res.ok) throw new Error(String(res.status));
        cert.revoked_at = ((await res.json()) as { revoked_at: string }).revoked_at;
        status.className = "cert-revoked";
        status.textContent = `revoked on ${day(cert.revoked_at)}`;
        note.textContent = "Revoked.";
        showActions();
        copy.focus();
      } catch {
        note.textContent = "It could not be revoked. Try again.";
        yes.disabled = false;
      }
    });
    yes.focus();
  });

  showActions();
  li.append(title, facts, actions, note);
  return li;
}

/** Fills the card. `pro` shows the PRO line when the list is empty. */
export async function renderCertificates(card: HTMLElement, pro: boolean): Promise<void> {
  const list = card.querySelector<HTMLElement>("[data-certs-list]");
  const empty = card.querySelector<HTMLElement>("[data-certs-empty]");
  const free = card.querySelector<HTMLElement>("[data-certs-free]");
  if (free) free.hidden = pro;
  let rows: CertificateRow[] = [];
  try {
    const res = await fetch("/api/certificates/", { credentials: "same-origin" });
    if (res.ok) rows = (await res.json()) as CertificateRow[];
  } catch {
    // Offline: the empty line stays.
  }
  if (!list || rows.length === 0) return;
  list.replaceChildren(...rows.map(row));
  list.hidden = false;
  if (empty) empty.hidden = true;
}
