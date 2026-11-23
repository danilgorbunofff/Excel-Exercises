// Why this exists: renders the real email templates (src/server/mail-templates.ts)
// with sample data, so these mockups show exactly what the cron job sends.
// Run: node docs/mockups/emails/build.mjs (Node 23+, which runs .ts directly).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dailyMail,
  employerTestMail,
  levelMail,
  offerMail,
  tipMail,
  weekMail,
  welcomeMail,
} from "../../../src/server/mail-templates.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Real daily tasks from content/daily/, matched to the weekday each email lands on
// for someone welcomed on Monday 23 November.
const TASKS = {
  mon: {
    tier: 1,
    title: "Cheapest quote",
    brief: "In B7, show the cheapest of the builders' quotes.",
    rows: [
      ["Builder", "Quote"],
      ["Hart", 4200],
      ["Lowe", 3850],
      ["Mace", 4475],
      ["Nash", 3990],
      ["Orr", 4100],
      ["Cheapest", null],
    ],
    answerCell: "B7",
  },
  tue: {
    tier: 2,
    title: "Average delivery time",
    brief: "In B9, find the average delivery time in days, rounded to one decimal place.",
    rows: [
      ["Parcel", "Days"],
      ["P1", 4],
      ["P2", 7],
      ["P3", 5],
      ["P4", 8],
      ["P5", 6],
      ["P6", 9],
      ["P7", 5],
      ["Average", null],
    ],
    answerCell: "B9",
  },
  wed: {
    tier: 3,
    title: "Count late deliveries",
    brief: "In D10, count the deliveries marked Late.",
    rows: [],
    answerCell: "D10",
  },
  fri: {
    tier: 5,
    title: "Rank of one rep",
    brief: "In C4, show where Cyd ranks on sales, with 1 for the highest.",
    rows: [],
    answerCell: "C4",
  },
  mon2: {
    tier: 1,
    title: "Highest quiz score",
    brief: "In B8, show the highest score in the quiz.",
    rows: [],
    answerCell: "B8",
  },
  thu: {
    tier: 4,
    title: "List the attendees",
    brief: "In B2, join the names of everyone who came, separated by a comma and a space.",
    rows: [],
    answerCell: "B2",
  },
  mon3: {
    tier: 1,
    title: "Cups of coffee this week",
    brief: "In B7, add up the cups of coffee sold from Monday to Friday.",
    rows: [],
    answerCell: "B7",
  },
};
const ctx = (today) => ({
  origin: "https://excelexercises.online",
  unsubscribe: "https://excelexercises.online/api/email/unsubscribe/?t=TOKEN",
  today,
});
// The sample test: one task per skill, as byFunction orders them, weakest first.
const SKILLS = [
  { name: "XLOOKUP", correct: 0, total: 1 },
  { name: "LEN", correct: 0, total: 1 },
  { name: "IF", correct: 1, total: 1 },
  { name: "SUM", correct: 1, total: 1 },
  { name: "DATEDIF", correct: 1, total: 1 },
  { name: "SUMIFS", correct: 1, total: 1 },
];

const emails = [
  { file: "d0-welcome.html", tag: "D0", name: "Welcome", mail: welcomeMail(ctx(TASKS.mon)) },
  { file: "daily.html", tag: "Daily", name: "Daily exercise", mail: dailyMail(ctx(TASKS.tue)) },
  {
    file: "d2-level.html",
    tag: "D2",
    name: "Your level (took the sample)",
    mail: levelMail(ctx(TASKS.wed), { score: 4, total: 6, skills: SKILLS }),
  },
  {
    file: "d2-level-not-taken.html",
    tag: "D2",
    name: "Your level (not taken yet)",
    mail: levelMail(ctx(TASKS.wed), null),
  },
  { file: "d4-tip.html", tag: "D4", name: "Tip: 5 functions", mail: tipMail(ctx(TASKS.fri)) },
  {
    file: "d7-week.html",
    tag: "D7",
    name: "Your week",
    mail: weekMail(ctx(TASKS.mon2), { solved: 9, streak: 4 }),
  },
  {
    file: "d10-employer-test.html",
    tag: "D10",
    name: "What an employer's test looks like",
    mail: employerTestMail(ctx(TASKS.thu)),
  },
  {
    file: "d14-lifetime.html",
    tag: "D14",
    name: "Offer: lifetime (launch window open)",
    mail: offerMail(ctx(TASKS.mon3), true),
  },
  {
    file: "d14-yearly.html",
    tag: "D14",
    name: "Offer: yearly (after the launch)",
    mail: offerMail(ctx(TASKS.mon3), false),
  },
].map((e) => ({
  ...e,
  subject: e.mail.subject,
  preheader: e.mail.html.match(/<div style="display:none[^>]*>([^&<]*)/)?.[1] ?? "",
}));

// The logo is not live yet, so the mockups load the repo copy.
for (const e of emails)
  writeFileSync(
    join(OUT, e.file),
    e.mail.html.replace(
      "https://excelexercises.online/email-logo.png",
      "../../../public/email-logo.png",
    ),
  );

/* ---------- index: every email at desktop and phone width ---------- */

const sections = emails
  .map(
    (e) => `<section class="mail" id="${e.file.replace(".html", "")}">
  <header class="mail-head">
    <span class="tag">${e.tag}</span>
    <h2>${esc(e.name)}</h2>
    <a class="open" href="${e.file}" target="_blank">Open alone</a>
  </header>
  <div class="inbox">
    <p class="subject">${esc(e.subject)}</p>
    <p class="pre">${esc(e.preheader)}</p>
  </div>
  <div class="frames">
    <figure><figcaption>Desktop &middot; 600px</figcaption><iframe src="${e.file}" width="640" title="${esc(e.name)}, desktop"></iframe></figure>
    <figure><figcaption>Phone &middot; 375px</figcaption><iframe src="${e.file}" width="375" title="${esc(e.name)}, phone"></iframe></figure>
  </div>
</section>`,
  )
  .join("\n");

writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Starter emails</title>
<style>
:root{color-scheme:light;--bg:#f3f4f6;--surface:#fff;--text:#101828;--muted:#4a5565;--rule:#e5e7eb;--line:#6a7282;--chip:#126a41;--chip-bg:#ecfdf3;--primary:#18804f}
:root[data-theme="dark"]{color-scheme:dark;--bg:#0f141c;--surface:#161c26;--text:#f3f4f6;--muted:#a3abb8;--rule:#2b3442;--line:#8a94a3;--chip:#7ee2a8;--chip-bg:#10241a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Inter,system-ui,sans-serif}
.top{position:sticky;top:0;z-index:1;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between;padding:14px 24px;background:var(--surface);border-bottom:1px solid var(--rule)}
.top h1{margin:0;font-size:18px}
.top p{margin:0;color:var(--muted);font-size:13px}
.switch{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.switch button{font:inherit;font-size:14px;padding:6px 14px;border:0;background:transparent;color:var(--text);cursor:pointer;min-height:36px}
.switch button[aria-pressed="true"]{background:var(--primary);color:#fff}
main{max-width:1120px;margin:0 auto;padding:24px 16px 64px}
nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px}
nav.toc a{font-size:13px;padding:4px 10px;border:1px solid var(--rule);border-radius:999px;color:var(--text);text-decoration:none;background:var(--surface)}
.notes{background:var(--surface);border:1px solid var(--rule);border-radius:8px;padding:16px 20px;margin:0 0 32px;font-size:14px}
.notes h2{font-size:15px;margin:0 0 6px}
.notes ul{margin:0 0 12px;padding-left:20px}
.notes li{margin:2px 0}
.mail{margin:0 0 48px}
.mail-head{display:flex;align-items:center;gap:10px;margin:0 0 8px}
.mail-head h2{margin:0;font-size:18px}
.tag{font-size:12px;font-weight:700;color:var(--chip);background:var(--chip-bg);padding:2px 8px;border-radius:999px}
.open{margin-left:auto;font-size:13px;color:var(--muted)}
.inbox{border:1px solid var(--rule);background:var(--surface);border-radius:8px;padding:10px 14px;margin:0 0 14px;max-width:640px}
.inbox p{margin:0}
.subject{font-weight:600}
.pre{color:var(--muted);font-size:14px}
.frames{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
figure{margin:0;max-width:100%}
figcaption{font-size:12px;color:var(--muted);margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
iframe{display:block;max-width:100%;height:700px;border:1px solid var(--rule);border-radius:8px;background:#fff}
</style>
</head>
<body>
<div class="top">
  <div><h1>Starter emails: mockups</h1><p>${emails.length} emails &middot; each frame is the real HTML file &middot; generated by build.mjs</p></div>
  <div class="switch" role="group" aria-label="Email theme">
    <button type="button" data-theme="light" aria-pressed="true">Light</button>
    <button type="button" data-theme="dark" aria-pressed="false">Dark</button>
  </div>
</div>
<main>
<nav class="toc">${emails.map((e) => `<a href="#${e.file.replace(".html", "")}">${e.tag} ${esc(e.name)}</a>`).join("")}</nav>
<div class="notes">
  <h2>Rules every email follows</h2>
  <ul>
    <li>Rendered from <code>src/server/mail-templates.ts</code>, the code that sends them. <code>/api/cron/daily/</code> sends one email a day at 12:00 UTC: welcome first, the series 2, 4, 7, 10 and 14 days after it, the daily exercise on other days. PRO members get no selling emails.</li>
    <li>One headline, one or two lines of text, one block (sheet, bars, links or list), one green button.</li>
    <li>Starter emails end with today&rsquo;s exercise in two lines. Only the daily email shows the sheet.</li>
    <li>Tables, inline CSS, 600px, system fonts. Dark mode via <code>color-scheme</code> and <code>prefers-color-scheme</code>.</li>
    <li>Footer: why you get it, one-click unsubscribe (plus a <code>List-Unsubscribe</code> header when sent), weekly instead.</li>
  </ul>
  <h2>Open questions</h2>
  <ul>
    <li>Which postal address goes in the footer? US law (CAN-SPAM) asks for one.</li>
    <li>Should the lifetime email give an end date?</li>
  </ul>
</div>
${sections}
</main>
<script>
const frames = [...document.querySelectorAll("iframe")];
let theme = "light";
// Browsers give a frame the system's prefers-color-scheme, so the switch lifts
// each email's own dark @media block out and applies it only when Dark is on.
function apply(f) {
  const doc = f.contentDocument;
  if (!doc?.styleSheets[0]) return; // not loaded yet (about:blank)
  if (f._dark == null) {
    const sheet = doc.styleSheets[0];
    const i = [...sheet.cssRules].findIndex((r) => r.media && r.conditionText.includes("prefers-color-scheme"));
    f._dark = [...sheet.cssRules[i].cssRules].map((r) => r.cssText).join("\\n");
    sheet.deleteRule(i);
    f._style = doc.createElement("style");
    doc.head.append(f._style);
  }
  f._style.textContent = theme === "dark" ? f._dark : "";
  f.style.height = doc.documentElement.scrollHeight + "px";
}
frames.forEach((f) => {
  f.addEventListener("load", () => apply(f));
  apply(f);
});
document.querySelectorAll(".switch button").forEach((b) =>
  b.addEventListener("click", () => {
    theme = b.dataset.theme;
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll(".switch button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    frames.forEach(apply);
  }),
);
</script>
</body>
</html>
`,
);
console.log(`wrote ${emails.length} emails and index.html`);
