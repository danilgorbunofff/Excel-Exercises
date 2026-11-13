// Why this exists: the /api/ functions answer a form by sending the visitor
// back with ?error= or ?ok=. This shows that message in [data-flash], carries
// ?next= into the form and the Google link, and fills ?email= into the email
// field. Text only: the message is put in with textContent, never as HTML.
const q = new URLSearchParams(location.search);
const error = q.get("error");
const ok = q.get("ok");
for (const el of document.querySelectorAll<HTMLElement>("[data-flash]")) {
  if (!error && !ok) continue;
  el.textContent = error ?? ok;
  el.dataset["kind"] = error ? "error" : "ok";
  el.setAttribute("role", error ? "alert" : "status");
  el.hidden = false;
}

const next = q.get("next");
if (next?.startsWith("/") && !next.startsWith("//")) {
  for (const input of document.querySelectorAll<HTMLInputElement>("[data-next-field]"))
    input.value = next;
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-next-link]")) {
    a.href = `${a.pathname}?next=${encodeURIComponent(next)}`;
  }
}

const email = q.get("email");
if (email) {
  const input = document.querySelector<HTMLInputElement>("[data-auth-form] input[name=email]");
  if (input && !input.value) input.value = email;
}
