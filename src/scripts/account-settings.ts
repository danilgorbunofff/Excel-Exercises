// Why this exists: fills the settings cards with the current choices from
// /api/me, shows the password card only to email-and-password accounts, and
// enables Delete once DELETE is typed.
import { loadMe } from "./session.ts";

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

void loadMe().then((me) => {
  if (!me) return;
  const news = $<HTMLInputElement>("[data-news]");
  if (news) news.checked = me.news;
  const digest = $<HTMLInputElement>("[data-digest]");
  if (digest) digest.checked = me.digest;
  const password = $("[data-password]");
  if (password) password.hidden = !me.hasPassword;
  const google = $("[data-google]");
  if (google) google.hidden = me.hasPassword;
});

const input = $<HTMLInputElement>("[data-delete-input]");
const button = $<HTMLButtonElement>("[data-delete-button]");
input?.addEventListener("input", () => {
  if (button) button.disabled = input.value.trim().toUpperCase() !== "DELETE";
});
