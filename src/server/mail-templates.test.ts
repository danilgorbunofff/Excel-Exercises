import { describe, expect, it } from "vitest";
import {
  dailyMail,
  type Email,
  employerTestMail,
  levelMail,
  type MailContext,
  mailFor,
  offerMail,
  tipMail,
  weekMail,
  welcomeMail,
} from "./mail-templates.ts";

const ctx: MailContext = {
  origin: "https://x.test",
  unsubscribe: "https://x.test/api/email/unsubscribe/?t=u1.sig",
  today: {
    title: "Average delivery time",
    brief: "In B9, find the average delivery time.",
    tier: 2,
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
};

describe("mailFor", () => {
  const on = (today: string, pro = false) => mailFor({ welcomedOn: "2026-11-23", today, pro });

  it("welcomes first, whatever the day", () => {
    expect(mailFor({ welcomedOn: null, today: "2026-12-25", pro: true })).toBe("welcome");
  });

  it("sends the series on days 2, 4, 7, 10 and 14 after the welcome, the daily email otherwise", () => {
    const days = ["24", "25", "26", "27", "28", "29", "30"].map((d) => on(`2026-11-${d}`));
    expect(days).toEqual(["daily", "level", "daily", "tip", "daily", "daily", "week"]);
    expect(on("2026-12-03")).toBe("employer");
    expect(on("2026-12-07")).toBe("offer");
    expect(on("2026-12-08")).toBe("daily");
  });

  it("sends PRO members no selling email", () => {
    expect([on("2026-11-25", true), on("2026-11-27", true)]).toEqual(["level", "tip"]);
    expect([on("2026-11-30", true), on("2026-12-03", true), on("2026-12-07", true)]).toEqual([
      "daily",
      "daily",
      "daily",
    ]);
  });
});

const all: [string, Email][] = [
  ["daily", dailyMail(ctx)],
  ["welcome", welcomeMail(ctx)],
  [
    "level",
    levelMail(ctx, { score: 4, total: 6, skills: [{ name: "XLOOKUP", correct: 0, total: 1 }] }),
  ],
  ["level, not taken", levelMail(ctx, null)],
  ["tip", tipMail(ctx)],
  ["week", weekMail(ctx, { solved: 9, streak: 4 })],
  ["employer", employerTestMail(ctx)],
  ["lifetime", offerMail(ctx, true)],
  ["yearly", offerMail(ctx, false)],
];

describe("every email", () => {
  it.each(all)("%s has one button, the unsubscribe link and a text part", (_, m) => {
    expect(m.html.match(/class="btn-a"/g)).toHaveLength(1);
    expect(m.html).toContain(`href="${ctx.unsubscribe}"`);
    expect(m.html).toContain("prefers-color-scheme:dark");
    expect(m.text).toContain(`Unsubscribe in one click: ${ctx.unsubscribe}`);
    expect(m.text).not.toMatch(/<|&[a-z]+;/u);
  });

  it("ends every starter email with today's exercise", () => {
    for (const [name, m] of all.slice(1)) {
      expect(m.html, name).toContain("Average delivery time");
      expect(m.text, name).toContain(
        "Today's exercise (Tuesday, easy (2 of 7)): Average delivery time",
      );
    }
  });
});

describe("dailyMail", () => {
  it("shows the sheet with the answer cell and a gap for the long middle", () => {
    const m = dailyMail(ctx);
    expect(m.subject).toBe("Today: Average delivery time");
    expect(m.html).toContain(">?</td>");
    expect(m.html).toContain("&#8942;");
    expect(m.html).not.toContain(">P4<");
  });
});

describe("levelMail", () => {
  it("names the weakest skill and links to its exercises", () => {
    const m = levelMail(ctx, {
      score: 5,
      total: 6,
      skills: [
        { name: "XLOOKUP", correct: 0, total: 1 },
        { name: "SUM", correct: 1, total: 1 },
      ],
    });
    expect(m.subject).toBe("Your Excel score: 83%");
    expect(m.html).toContain("Your weak spot is <strong>XLOOKUP</strong>");
    expect(m.html).toContain('href="https://x.test/exercises/?fn=XLOOKUP"');
    expect(m.text).toContain("SUM: 100%\nXLOOKUP: 0%");
  });

  it("points to the full tests when every skill is right", () => {
    const m = levelMail(ctx, {
      score: 6,
      total: 6,
      skills: [{ name: "SUM", correct: 1, total: 1 }],
    });
    expect(m.html).toContain("No weak spot");
    expect(m.html).toContain('href="https://x.test/mock-assessments/"');
  });
});

describe("offerMail", () => {
  it("sells lifetime during the launch, else the yearly plan, at the list prices", () => {
    expect(offerMail(ctx, true).subject).toBe("PRO for life: $129, once");
    expect(offerMail(ctx, false).subject).toBe("PRO for a year: $59");
    expect(offerMail(ctx, false).text).toContain("$4.92 a month");
  });
});
