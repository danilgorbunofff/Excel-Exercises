// Why this exists: fills the Plan and billing page. /api/me says whether the
// account has PRO; /api/billing/ adds the plan key, renewal, card and payments
// from Stripe. Free accounts see the plans to buy; subscribers see them as
// switches through the Stripe portal; lifetime needs neither.
import { planLine } from "../lib/access.ts";
import type { BillingInfo } from "../server/billing.ts";
import { loadMe } from "./session.ts";

const node = document.querySelector("script[data-plans-data]");
const plans: { key: string; label: string; price: string }[] = node?.textContent
  ? JSON.parse(node.textContent)
  : [];
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);
const text = (s: string, v: string) => {
  const el = $(s);
  if (el) el.textContent = v;
};
const show = (s: string, on: boolean) => {
  for (const el of document.querySelectorAll<HTMLElement>(s)) el.hidden = !on;
};
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

async function billing(): Promise<BillingInfo | null> {
  try {
    const res = await fetch("/api/billing/", { credentials: "same-origin" });
    if (res.ok) return (await res.json()) as BillingInfo;
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const err = $("[data-billing-error]");
    if (err && body.error) {
      err.textContent = body.error;
      err.hidden = false;
    }
  } catch {
    // Offline: the plan from /api/me still shows.
  }
  return null;
}

void loadMe().then(async (me) => {
  if (!me) return;
  const lifetime = me.proStatus === "lifetime";
  const state = !me.pro ? "free" : lifetime ? "lifetime" : "sub";
  for (const card of document.querySelectorAll<HTMLElement>("[data-cur]"))
    card.hidden = card.dataset.cur !== state;
  show("[data-plans]", state !== "lifetime");
  show("[data-pay]", me.pro);
  if (state === "sub") {
    text("[data-sub-renew]", planLine(me));
    if (me.proStatus === "past_due") {
      const pill = $("[data-sub-state]");
      if (pill) [pill.className, pill.textContent] = ["pill bad", "Payment failed"];
    }
    text("[data-plans-title]", "Change plan");
    text(
      "[data-plans-note]",
      "Switching happens in Stripe, which works out any credit for the time you have left.",
    );
    show("[data-buy]", false);
    show("[data-switch]", true);
  }

  const info = await billing();
  if (!info) return;
  const plan = plans.find((p) => p.key === info.plan);
  if (state === "sub" && plan) {
    text("[data-sub-name]", `PRO, ${plan.label.toLowerCase()}`);
    text("[data-sub-price]", plan.price);
    if (info.renews)
      text(
        "[data-sub-renew]",
        info.ending
          ? `Ends on ${day(info.renews)}. It will not renew.`
          : `Renews on ${day(info.renews)}.`,
      );
    for (const li of document.querySelectorAll<HTMLElement>("[data-plan-card]")) {
      const current = li.dataset.planCard === info.plan;
      li.classList.toggle("current", current);
      const tag = li.querySelector<HTMLElement>("[data-current]");
      if (tag) tag.hidden = !current;
      for (const save of li.querySelectorAll<HTMLElement>("[data-save]")) save.hidden = current;
      const sw = li.querySelector<HTMLElement>("[data-switch]");
      if (sw) sw.hidden = current;
    }
  }
  if (info.card) {
    text("[data-card-brand]", info.card.brand.toUpperCase().slice(0, 4));
    text(
      "[data-card-line]",
      `${info.card.brand[0]?.toUpperCase()}${info.card.brand.slice(1)} ending ${info.card.last4}`,
    );
    text(
      "[data-card-exp]",
      `Expires ${String(info.card.expMonth).padStart(2, "0")}/${info.card.expYear}`,
    );
  }
  show("[data-history]", info.payments.length > 0);
  $("[data-payments]")?.replaceChildren(
    ...info.payments.map((p) => {
      const tr = document.createElement("tr");
      const status = document.createElement("td");
      status.append(
        Object.assign(document.createElement("span"), {
          className: p.status === "paid" ? "pill ok" : p.status === "failed" ? "pill bad" : "pill",
          textContent: p.status === "paid" ? "Paid" : p.status === "failed" ? "Failed" : "Refunded",
        }),
      );
      const receipt = document.createElement("td");
      receipt.className = "r";
      if (p.receiptUrl) {
        receipt.append(
          Object.assign(document.createElement("a"), {
            className: "lnk",
            href: p.receiptUrl,
            textContent: "Receipt",
            rel: "noopener",
            target: "_blank",
          }),
        );
      }
      tr.append(
        Object.assign(document.createElement("td"), {
          className: "tnum nowrap",
          textContent: day(p.date),
        }),
        Object.assign(document.createElement("td"), { textContent: p.description }),
        Object.assign(document.createElement("td"), {
          className: "r tnum",
          textContent: money(p.amountCents, p.currency),
        }),
        status,
        receipt,
      );
      return tr;
    }),
  );
});
