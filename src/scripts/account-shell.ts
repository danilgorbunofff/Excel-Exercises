// Why this exists: fills the account menu's identity line (initial, PRO or
// Free) once /api/me answers. session.ts fills the email itself.
import { loadMe } from "./session.ts";

void loadMe().then((me) => {
  if (!me) return;
  const initial = document.querySelector<HTMLElement>("[data-ac-initial]");
  if (initial) initial.textContent = me.email.trim().charAt(0).toUpperCase();
  const pro = document.querySelector<HTMLElement>("[data-ac-pro]");
  if (pro) pro.hidden = !me.pro;
  const free = document.querySelector<HTMLElement>("[data-ac-free]");
  if (free) free.hidden = me.pro;
});
