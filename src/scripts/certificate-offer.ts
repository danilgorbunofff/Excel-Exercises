// Why this exists: the certificate line on a mock assessment result. After a
// passed, timed run is saved, it asks for the name to print and claims the
// certificate from /api/certificates/, which checks the saved attempt itself.
// A pass that cannot earn one says why in one sentence.
import { certificatePath, passes } from "../lib/certificates.ts";

export interface Saved {
  /** The saved attempt's id, from /api/assessments/. */
  id: string;
  /** The score the server marked. */
  score: number;
  total: number;
}

interface Row {
  id: string;
  name: string;
  assessment: string;
  revoked_at: string | null;
}

function link(id: string): HTMLParagraphElement {
  const p = document.createElement("p");
  const a = document.createElement("a");
  a.href = certificatePath(id);
  a.textContent = "View your certificate";
  p.append(a, ". It is also listed on your ");
  const account = document.createElement("a");
  account.href = "/account/";
  account.textContent = "account page";
  p.append(account, ".");
  return p;
}

export async function offerCertificate(
  box: HTMLElement,
  run: { slug: string; sample: boolean; timed: boolean; saved: Saved },
): Promise<void> {
  const { saved } = run;
  if (run.sample || !passes(saved.score, saved.total)) return;
  box.hidden = false;
  if (!run.timed) {
    box.replaceChildren(
      Object.assign(document.createElement("p"), {
        textContent:
          "You passed. Only a timed run earns a certificate: take it again with the time limit on.",
      }),
    );
    return;
  }

  let mine: Row[] = [];
  try {
    const res = await fetch("/api/certificates/", { credentials: "same-origin" });
    if (res.ok) mine = (await res.json()) as Row[];
  } catch {
    // No prefill; the form still works.
  }
  const live = mine.find((c) => c.assessment === run.slug && c.revoked_at === null);
  if (live) {
    box.replaceChildren(link(live.id));
    return;
  }

  const form = document.createElement("form");
  form.className = "cert-form";
  form.noValidate = true;
  const label = document.createElement("label");
  label.htmlFor = "cert-name";
  label.textContent = "Name to print on your certificate";
  const input = document.createElement("input");
  input.id = "cert-name";
  input.name = "name";
  input.autocomplete = "name";
  input.maxLength = 80;
  input.required = true;
  input.value = mine[0]?.name ?? "";
  const note = document.createElement("p");
  note.className = "a-note";
  note.id = "cert-note";
  note.setAttribute("role", "status");
  input.setAttribute("aria-describedby", "cert-note");
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "button button-primary";
  button.textContent = "Get certificate";
  const intro = document.createElement("p");
  intro.textContent = `You passed with ${saved.score} of ${saved.total}. Get a certificate with a link that anyone can check.`;
  form.append(label, input, button, note);
  box.replaceChildren(intro, form);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) {
      note.textContent = "Type the name to print.";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    button.disabled = true;
    note.textContent = "";
    try {
      const res = await fetch("/api/certificates/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt: saved.id, name }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && body.id) {
        box.replaceChildren(link(body.id));
        return;
      }
      note.textContent =
        res.status === 400 && body.error
          ? body.error
          : "No certificate this time. Reload the page to try again.";
      input.setAttribute("aria-invalid", String(res.status === 400));
    } catch {
      note.textContent = "No connection. Try again.";
    }
    button.disabled = false;
  });
}
