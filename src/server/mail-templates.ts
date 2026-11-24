// Why this exists: the HTML emails (daily exercise and the starter series) and
// mailFor, which picks the one email a person gets today. Pure: the cron job
// reads the rows and sends. docs/mockups/emails/build.mjs renders these same
// functions with sample data, so the mockups never drift from what is sent.
//
// Email HTML rules: tables, inline CSS, 600px, system fonts, one button.
// Dark mode: each colour is inline (light) plus a class that the
// prefers-color-scheme block (Apple Mail, iOS) and [data-ogsc] (Outlook.com)
// switch to the dark value. Gmail apps invert colours their own way.
import { TIER_NAMES } from "../lib/daily.ts";
import { PLANS } from "./plans.ts";

export interface Email {
  subject: string;
  html: string;
  text: string;
}

/** Today's daily task, as the emails show it. */
export interface TaskView {
  title: string;
  /** The task's prompt. */
  brief: string;
  /** Step of the week, 1 (Monday) to 7 (Sunday). */
  tier: number;
  rows: readonly (readonly (string | number | boolean | null)[])[];
  answerCell: string;
}

export interface MailContext {
  /** The site origin, such as https://excelexercises.online, without a trailing slash. */
  origin: string;
  /** This person's one-click unsubscribe link. */
  unsubscribe: string;
  today: TaskView;
}

/** Score per function in the sample test, as byFunction counts it. */
export interface SkillScore {
  name: string;
  correct: number;
  total: number;
}

export type StarterKind = "welcome" | "level" | "tip" | "week" | "employer" | "offer" | "daily";

// Days after the welcome email. Every other day is the plain daily email.
const SERIES: Readonly<Record<number, StarterKind>> = {
  2: "level",
  4: "tip",
  7: "week",
  10: "employer",
  14: "offer",
};
const SELLING: ReadonlySet<StarterKind> = new Set(["week", "employer", "offer"]);

/**
 * The one email for a person today. The series counts from the welcome email,
 * not from sign-up, so someone who turns the email on weeks later still gets
 * it in order. PRO members get no selling emails.
 */
export function mailFor(s: {
  welcomedOn: string | null;
  today: string;
  pro: boolean;
}): StarterKind {
  if (!s.welcomedOn) return "welcome";
  const days = Math.round((Date.parse(s.today) - Date.parse(s.welcomedOn)) / 86_400_000);
  const kind = SERIES[days] ?? "daily";
  return s.pro && SELLING.has(kind) ? "daily" : kind;
}

/* ---------- colours and blocks ---------- */

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
// [light, dark]. Names follow src/styles/tokens.css.
const C = {
  page: ["#ffffff", "#161c26"],
  text: ["#101828", "#f3f4f6"],
  muted: ["#4a5565", "#a3abb8"],
  rule: ["#e5e7eb", "#2b3442"],
  gridHead: ["#f3f4f6", "#1f2733"],
  gridLine: ["#d0d5dd", "#3a4556"],
  link: ["#126a41", "#7ee2a8"],
  ans: ["#e9f9ef", "#0f2f1d"],
  track: ["#e5e7eb", "#2b3442"],
} as const;
const PRIMARY = "#18804f";
const BAR = "#2f9e5a";
const BAR_WEAK = "#dc3d43";
const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DARK_RULES = Object.entries(C).flatMap(([k, [, dark]]) => [
  `.bg-${k}{background-color:${dark}!important}`,
  `.c-${k}{color:${dark}!important}`,
  `.b-${k}{border-color:${dark}!important}`,
]);

const esc = (s: unknown) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const usd = (key: (typeof PLANS)[number]["key"]) =>
  `$${(PLANS.find((p) => p.key === key)?.listCents ?? 0) / 100}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (s: SkillScore) => Math.round((100 * s.correct) / s.total);

const p = (html: string, extra = "") =>
  `<p class="c-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text[0]};${extra}">${html}</p>`;

const muted = (html: string, extra = "") =>
  `<p class="c-muted" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:21px;color:${C.muted[0]};${extra}">${html}</p>`;

const h1 = (text: string) =>
  `<h1 class="c-text h1" style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:31px;font-weight:700;color:${C.text[0]};">${text}</h1>`;

const a = (label: string, href: string, extra = "") =>
  `<a class="c-link" href="${esc(href)}" style="color:${C.link[0]};text-decoration:underline;${extra}">${label}</a>`;

/** The one button of an email. Full width on a phone. */
const button = (label: string, href: string) =>
  `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
<tr><td align="center" bgcolor="${PRIMARY}" style="border-radius:6px;background-color:${PRIMARY};">
<a href="${esc(href)}" class="btn-a" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
</td></tr></table>`;

/** Short rows: a link, then a few plain words after it. */
const linkList = (items: readonly { title: string; href: string; text: string }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${items
    .map(
      (it) =>
        `<tr><td class="c-text b-rule" style="padding:11px 0;border-top:1px solid ${C.rule[0]};font-family:${FONT};font-size:16px;line-height:23px;color:${C.text[0]};">${a(it.title, it.href, "font-weight:600;")}<span class="c-muted" style="color:${C.muted[0]};"> &nbsp;${it.text}</span></td></tr>`,
    )
    .join("")}</table>`;

/** A plain dash list. */
const list = (items: readonly string[]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${items
    .map(
      (
        it,
      ) => `<tr><td valign="top" class="c-muted" style="padding:0 10px 6px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${C.muted[0]};">&ndash;</td>
<td class="c-text" style="padding:0 0 6px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text[0]};">${it}</td></tr>`,
    )
    .join("")}</table>`;

const stepOf = (t: TaskView) =>
  `${DAYS[t.tier] ?? ""}, ${(TIER_NAMES[t.tier] ?? "").toLowerCase()} (${t.tier} of 7)`;

/** A small sheet like the site's: column letters, row numbers, the answer cell lit. Full width. */
function miniGrid(rows: TaskView["rows"], answerCell: string): string {
  const col = answerCell.charCodeAt(0) - 65;
  const row = Number(answerCell.slice(1)) - 1;
  const width = rows[0]?.length ?? 0;
  type Shown = { n: number; r: TaskView["rows"][number] } | { gap: true };
  let shown: Shown[] = rows.map((r, i) => ({ n: i + 1, r }));
  // Long sheets: keep the header, three data rows, a gap, and the answer row.
  if (rows.length > 7)
    shown = [...shown.slice(0, 4), { gap: true }, { n: row + 1, r: rows[row] ?? [] }];
  const cell = `padding:6px 10px;border:1px solid ${C.gridLine[0]};font-family:${FONT};font-size:13px;line-height:18px;white-space:nowrap;`;
  const head = `${cell}background-color:${C.gridHead[0]};color:${C.muted[0]};text-align:center;`;
  const hc = `class="bg-gridHead c-muted b-gridLine"`;
  const numeric = Array.from({ length: width }, (_, i) =>
    rows.slice(1).some((r) => typeof r[i] === "number"),
  );
  let html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 24px;">`;
  html += `<tr><td ${hc} width="32" style="${head}width:32px;padding:6px 0;">&nbsp;</td>${numeric
    .map(
      (_, i) =>
        `<td ${hc} width="${Math.floor(100 / width)}%" style="${head}">${String.fromCharCode(65 + i)}</td>`,
    )
    .join("")}</tr>`;
  for (const s of shown) {
    if ("gap" in s) {
      html += `<tr><td ${hc} style="${head}">&#8942;</td><td colspan="${width}" class="c-muted b-gridLine" style="${cell}color:${C.muted[0]};text-align:center;">&#8942;</td></tr>`;
      continue;
    }
    html += `<tr><td ${hc} style="${head}">${s.n}</td>`;
    for (let i = 0; i < width; i++) {
      const v = s.r[i] ?? null;
      if (s.n - 1 === row && i === col) {
        html += `<td class="bg-ans c-link" style="${cell}border:2px solid ${PRIMARY};background-color:${C.ans[0]};color:${C.link[0]};font-weight:700;text-align:center;">?</td>`;
      } else {
        const weight = s.n === 1 ? "font-weight:600;" : "";
        html += `<td class="c-text b-gridLine" style="${cell}${weight}color:${C.text[0]};text-align:${numeric[i] ? "right" : "left"};">${v === null ? "&nbsp;" : esc(v)}</td>`;
      }
    }
    html += `</tr>`;
  }
  return `${html}</table>`;
}

/** Today's exercise in two lines, at the foot of every starter email. */
const taskTeaser = (t: TaskView, origin: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 0;"><tr><td class="b-rule" style="padding:20px 0 0;border-top:1px solid ${C.rule[0]};">
${muted(`Today&rsquo;s exercise &middot; ${stepOf(t)}`, "margin:0 0 4px;")}
<p class="c-text" style="margin:0;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text[0]};">${a(`<strong>${esc(t.title)}</strong>`, `${origin}/daily/`)} &nbsp;${esc(t.brief)}</p>
</td></tr></table>`;

/** Score per skill. Every bar is green except the weakest, so the eye lands on it. */
function skillBars(skills: readonly SkillScore[], weakest: SkillScore | null): string {
  const rows = skills
    .map((s) => {
      const weak = s === weakest;
      const color = weak ? BAR_WEAK : BAR;
      const score = pct(s);
      const bold = weak ? "font-weight:700;" : "";
      return `<tr>
<td class="c-text skill-name" style="padding:6px 12px 6px 0;font-family:${FONT};font-size:15px;line-height:20px;color:${C.text[0]};width:42%;${bold}">${esc(s.name)}</td>
<td style="padding:6px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${score > 0 || weak ? `<td width="${Math.max(score, 2)}%" bgcolor="${color}" style="height:8px;line-height:8px;font-size:0;background-color:${color};">&nbsp;</td>` : ""}
${score < 100 ? `<td class="bg-track" style="height:8px;line-height:8px;font-size:0;background-color:${C.track[0]};">&nbsp;</td>` : ""}
</tr></table></td>
<td class="c-text" align="right" style="padding:6px 0 6px 12px;font-family:${FONT};font-size:15px;line-height:20px;color:${C.text[0]};width:40px;${bold}">${score}%</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;">${rows}</table>`;
}

/* ---------- layout ---------- */

const WHY = "You signed up for the daily exercise and tips.";

function layout(
  ctx: Pick<MailContext, "origin" | "unsubscribe">,
  m: {
    subject: string;
    preheader: string;
    body: string;
    text: string[];
    /** Why this email came. The daily series when absent. */
    why?: string;
  },
): Email {
  const { origin, unsubscribe } = ctx;
  const why = m.why ?? WHY;
  // The weekly email is the "weekly instead" choice, so it links to settings.
  const other = m.why ? "Email settings" : "Weekly instead";
  const css = `
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
@media (max-width:620px){
  .main-pad{padding:28px 20px 32px!important}
  .h1{font-size:22px!important;line-height:29px!important}
  .btn{width:100%!important}
  .btn-a{display:block!important;text-align:center!important}
  .skill-name{width:50%!important}
}
@media (prefers-color-scheme:dark){
  ${DARK_RULES.join("\n  ")}
}
${DARK_RULES.map((r) => `[data-ogsc] ${r}`).join("\n")}`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(m.subject)}</title>
<style>${css}</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background-color:${C.page[0]};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.page[0]};">${esc(m.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" bgcolor="${C.page[0]}" style="background-color:${C.page[0]};">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td class="main-pad" style="padding:40px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;"><tr>
<td valign="middle"><a href="${origin}/"><img src="${origin}/email-logo.png" width="24" height="24" alt="" style="display:block;border:0;"></a></td>
<td valign="middle" style="padding-left:8px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;"><a class="c-text" href="${origin}/" style="color:${C.text[0]};text-decoration:none;">Excel Exercises</a></td>
</tr></table>

${m.body}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0;"><tr><td class="c-muted b-rule" style="padding:20px 0 0;border-top:1px solid ${C.rule[0]};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted[0]};">
${why}<br>
<a class="c-muted" href="${esc(unsubscribe)}" style="color:${C.muted[0]};">Unsubscribe</a> &middot;
<a class="c-muted" href="${origin}/account/settings/" style="color:${C.muted[0]};">${other}</a><br>
Excel Exercises, [postal address]
</td></tr></table>

</td></tr></table>
</td></tr></table>
</body>
</html>
`;
  const text = [
    ...m.text,
    "",
    "--",
    why,
    `Unsubscribe in one click: ${unsubscribe}`,
    `${other}: ${origin}/account/settings/`,
  ].join("\n");
  return { subject: m.subject, html, text };
}

/** Today's exercise in the plain-text part, after the main text. */
const teaserText = (ctx: MailContext) => [
  "",
  `Today's exercise (${stepOf(ctx.today)}): ${ctx.today.title}`,
  ctx.today.brief,
  `${ctx.origin}/daily/`,
];

const PRO_ADDS = [
  "5 full timed tests, like an employer&rsquo;s",
  "A certificate with a link anyone can check",
  "330 function drills and 88 more exercises",
];
const proText = PRO_ADDS.map((s) => `- ${s.replace("&rsquo;", "'")}`);

/* ---------- the emails ---------- */

export function dailyMail(ctx: MailContext): Email {
  const t = ctx.today;
  return layout(ctx, {
    subject: `Today: ${t.title}`,
    preheader: `${stepOf(t)}. About two minutes.`,
    body: `${muted(stepOf(t), "margin:0 0 6px;")}
${h1(esc(t.title))}
${p(esc(t.brief))}
${miniGrid(t.rows, t.answerCell)}
${button("Solve it", `${ctx.origin}/daily/`)}`,
    text: [
      `Today's exercise: ${t.title}`,
      stepOf(t),
      "",
      t.brief,
      "",
      `Solve it: ${ctx.origin}/daily/`,
    ],
  });
}

export function welcomeMail(ctx: MailContext): Email {
  const o = ctx.origin;
  return layout(ctx, {
    subject: "Welcome to Excel Exercises",
    preheader: "Start with a 10-minute level check.",
    body: `${h1("Welcome. Here&rsquo;s where to start.")}
${p("Most people begin with the level check. It shows which skills to practise first.")}
${linkList([
  { title: "Check your level", href: `${o}/mock-assessments/sample/`, text: "10 minutes" },
  { title: "Today&rsquo;s exercise", href: `${o}/daily/`, text: "2 minutes" },
  {
    title: "First track: Cells and arithmetic",
    href: `${o}/exercises/tracks/references/`,
    text: "free",
  },
])}
${button("Check my level", `${o}/mock-assessments/sample/`)}
${taskTeaser(ctx.today, o)}`,
    text: [
      "Welcome. Here's where to start.",
      "",
      "Most people begin with the level check. It shows which skills to practise first.",
      "",
      `Check your level (10 minutes): ${o}/mock-assessments/sample/`,
      `Today's exercise (2 minutes): ${o}/daily/`,
      `First track, Cells and arithmetic (free): ${o}/exercises/tracks/references/`,
      ...teaserText(ctx),
    ],
  });
}

/**
 * The level email. With a sample result: the score per skill and where to
 * practise. Without one: an invitation to take the sample test.
 * `skills` is in byFunction order, weakest first.
 */
export function levelMail(
  ctx: MailContext,
  result: { score: number; total: number; skills: readonly SkillScore[] } | null,
): Email {
  const o = ctx.origin;
  if (!result) {
    return layout(ctx, {
      subject: "How good is your Excel?",
      preheader: "6 tasks, 10 minutes, a score for each skill.",
      body: `${h1("How good is your Excel?")}
${p("Six short tasks, ten minutes. You get a score for each skill and know what to practise first.")}
${button("Check my level", `${o}/mock-assessments/sample/`)}
${taskTeaser(ctx.today, o)}`,
      text: [
        "How good is your Excel?",
        "",
        "Six short tasks, ten minutes. You get a score for each skill and know what to practise first.",
        "",
        `Check your level: ${o}/mock-assessments/sample/`,
        ...teaserText(ctx),
      ],
    });
  }
  const score = Math.round((100 * result.score) / result.total);
  const first = result.skills[0];
  const weakest = first && first.correct < first.total ? first : null;
  const shown = [...result.skills].reverse();
  const next = weakest
    ? {
        label: `Practise ${esc(weakest.name)}`,
        href: `${o}/exercises/?fn=${encodeURIComponent(weakest.name)}`,
      }
    : { label: "See the full tests", href: `${o}/mock-assessments/` };
  const line = weakest
    ? `Your weak spot is <strong>${esc(weakest.name)}</strong>. A few free exercises will fix that.`
    : "No weak spot. The full timed tests are the next step.";
  return layout(ctx, {
    subject: `Your Excel score: ${score}%`,
    preheader: weakest
      ? `Your weak spot is ${weakest.name}. Here's where to practise.`
      : "No weak spot.",
    body: `${h1(`You scored ${score}%`)}
${p(line)}
${skillBars(shown, weakest)}
${button(next.label, next.href)}
${taskTeaser(ctx.today, o)}`,
    text: [
      `You scored ${score}%`,
      "",
      line.replace(/<\/?strong>/g, ""),
      "",
      ...shown.map((s) => `${s.name}: ${pct(s)}%`),
      "",
      `${next.label.replace("&amp;", "&")}: ${next.href}`,
      ...teaserText(ctx),
    ],
  });
}

const TIPS = [
  { fn: "SUMIFS", slug: "sumifs-or-sumproduct", text: "total with conditions" },
  { fn: "COUNTIFS", slug: "countif-and-countifs", text: "count with conditions" },
  { fn: "IF", slug: "if-ifs-and-nested-if", text: "one result or another" },
  { fn: "XLOOKUP", slug: "xlookup-explained", text: "find a value in a list" },
  { fn: "TRIM", slug: "trim-clean-and-hidden-spaces", text: "clean up pasted text" },
];

export function tipMail(ctx: MailContext): Email {
  const o = ctx.origin;
  return layout(ctx, {
    subject: "5 functions most Excel tests ask for",
    preheader: "SUMIFS, COUNTIFS, IF, XLOOKUP, TRIM.",
    body: `${h1("5 functions most Excel tests ask for")}
${p("Know these and most office tests get a lot easier. Each guide takes about five minutes.")}
${linkList(TIPS.map((t) => ({ title: t.fn, href: `${o}/articles/${t.slug}/`, text: t.text })))}
${button("What employers test", `${o}/articles/excel-skills-test/`)}
${taskTeaser(ctx.today, o)}`,
    text: [
      "5 functions most Excel tests ask for",
      "",
      "Know these and most office tests get a lot easier. Each guide takes about five minutes.",
      "",
      ...TIPS.map((t) => `${t.fn}, ${t.text}: ${o}/articles/${t.slug}/`),
      "",
      `What employers test: ${o}/articles/excel-skills-test/`,
      ...teaserText(ctx),
    ],
  });
}

export function weekMail(ctx: MailContext, stats: { solved: number; streak: number }): Email {
  const o = ctx.origin;
  const title =
    stats.solved > 0 ? `Week one: ${plural(stats.solved, "exercise")} solved` : "Your first week";
  const line =
    stats.streak > 1
      ? `You&rsquo;re on a ${stats.streak}-day streak. When your test date gets close, PRO adds:`
      : "When your test date gets close, PRO adds:";
  return layout(ctx, {
    subject: title,
    preheader: "And what PRO adds when your test gets close.",
    body: `${h1(title)}
${p(line)}
${list(PRO_ADDS)}
${button("See PRO", `${o}/pricing/`)}
${muted(`From ${usd("monthly")} a month. Cancel any time.`, "margin:12px 0 0;")}
${taskTeaser(ctx.today, o)}`,
    text: [
      title,
      "",
      line.replace("&rsquo;", "'"),
      ...proText,
      "",
      `See PRO (from ${usd("monthly")} a month): ${o}/pricing/`,
      ...teaserText(ctx),
    ],
  });
}

const PREVIEW_TASKS = [
  "Orders of 250 or more",
  "Online sales total",
  "Remote staff in sales",
  "Price for a part number",
  "Manager or Unknown",
];

export function employerTestMail(ctx: MailContext): Email {
  const o = ctx.origin;
  const intro =
    "Usually 20 to 40 minutes, 10 to 15 tasks on company data, no hints. Our full tests work the same way. Here are the first five from one of them:";
  return layout(ctx, {
    subject: "What an employer's Excel test looks like",
    preheader: "Timed, no hints, 10 to 15 tasks.",
    body: `${h1("What an employer&rsquo;s Excel test looks like")}
${p(intro)}
${muted("Intermediate &middot; 35 minutes &middot; 10 tasks", "margin:0 0 4px;")}
${list(PREVIEW_TASKS)}
${button("See the full tests", `${o}/mock-assessments/`)}
${taskTeaser(ctx.today, o)}`,
    text: [
      "What an employer's Excel test looks like",
      "",
      intro,
      "Intermediate, 35 minutes, 10 tasks:",
      ...PREVIEW_TASKS.map((t) => `- ${t}`),
      "",
      `See the full tests: ${o}/mock-assessments/`,
      ...teaserText(ctx),
    ],
  });
}

/** The offer on day 14: lifetime while the launch offer is open, else yearly. */
export function offerMail(ctx: MailContext, lifetime: boolean): Email {
  const o = ctx.origin;
  if (lifetime) {
    const line =
      "We only sell lifetime PRO during the launch. When the launch ends, so does this offer.";
    return layout(ctx, {
      subject: `PRO for life: ${usd("lifetime")}, once`,
      preheader: "Only sold during the launch.",
      body: `${h1(`PRO for life: ${usd("lifetime")}, once`)}
${p(line)}
${list(PRO_ADDS)}
${button("Get lifetime PRO", `${o}/pricing/`)}
${muted(`Or pay ${a("monthly, quarterly or yearly", `${o}/pricing/`, "color:inherit;")}.`, "margin:12px 0 0;")}
${taskTeaser(ctx.today, o)}`,
      text: [
        `PRO for life: ${usd("lifetime")}, once`,
        "",
        line,
        ...proText,
        "",
        `Get lifetime PRO: ${o}/pricing/`,
        ...teaserText(ctx),
      ],
    });
  }
  const monthly = (PLANS.find((p) => p.key === "annual")?.listCents ?? 0) / 1200;
  const line = `That&rsquo;s $${monthly.toFixed(2)} a month, about a third of the monthly price.`;
  return layout(ctx, {
    subject: `PRO for a year: ${usd("annual")}`,
    preheader: `$${monthly.toFixed(2)} a month, a third of the monthly price.`,
    body: `${h1(`PRO for a year: ${usd("annual")}`)}
${p(line)}
${list(PRO_ADDS)}
${button("Get PRO yearly", `${o}/pricing/`)}
${muted(`Test in a few weeks? ${a(`3 months is ${usd("quarterly")}`, `${o}/pricing/`, "color:inherit;")}.`, "margin:12px 0 0;")}
${taskTeaser(ctx.today, o)}`,
    text: [
      `PRO for a year: ${usd("annual")}`,
      "",
      line.replace("&rsquo;", "'"),
      ...proText,
      "",
      `Get PRO yearly: ${o}/pricing/`,
      ...teaserText(ctx),
    ],
  });
}

/** The Monday email for people who chose weekly: the counts, then the review list. */
export function weeklyMail(
  ctx: Pick<MailContext, "origin" | "unsubscribe">,
  m: { subject: string; lines: readonly string[]; progress: string },
): Email {
  return layout(ctx, {
    subject: m.subject,
    preheader: m.lines.join(" "),
    body: `${muted("Your week", "margin:0 0 6px;")}
${h1(esc(m.subject))}
${list(m.lines.map(esc))}
${button("See your review list", m.progress)}`,
    text: [...m.lines, "", `See your review list: ${m.progress}`],
    why: "You get this email because you turned on the weekly email in your account settings.",
  });
}
