// Why this exists: fills account settings with the current plan, renewal date
// and email preference, hides the password form for Google-only accounts, and
// shows the daily streak, joined with the account's days, and the certificates.
import { renderCertificates } from "./certificates-view.ts";
import { syncDaily } from "./daily-sync.ts";
import { renderStreak } from "./daily-view.ts";
import { loadMe } from "./session.ts";

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

void loadMe().then((me) => {
  if (!me) return;
  const free = $("[data-plan-free]");
  const pro = $("[data-plan-pro]");
  if (free) free.hidden = me.pro;
  if (pro) pro.hidden = !me.pro;
  const renews = $("[data-renews]");
  if (renews && me.proStatus === "lifetime") {
    renews.textContent = "You have lifetime PRO. It never renews or ends.";
  } else if (renews && me.proUntil) {
    const day = new Date(me.proUntil).toLocaleDateString(undefined, { dateStyle: "long" });
    renews.textContent =
      me.proStatus === "past_due"
        ? `Your last payment failed. Update your card before ${day}.`
        : `Your PRO plan renews or ends on ${day}.`;
  }
  const news = $<HTMLInputElement>("[data-news]");
  if (news) news.checked = me.news;
  const password = $("[data-password]");
  if (password) password.hidden = !me.hasPassword;
  const certs = $("[data-certs]");
  if (certs) void renderCertificates(certs, me.pro);
});

const streak = $("[data-streak]");
if (streak) void syncDaily().then(({ days }) => renderStreak(streak, days));
