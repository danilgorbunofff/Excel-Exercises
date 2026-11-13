import { describe, expect, it } from "vitest";
import { extractHtmlText, lintHtml, lintText, lintYamlStrings } from "./copy-lint.ts";

const rules = (text: string) => lintText(text).map((i) => i.rule);

describe("lintText", () => {
  it("passes plain copy", () => {
    expect(lintText("Your range stops at B4. Extend it to B5.")).toEqual([]);
  });

  it.each([
    ["Totals — by month", "no-dash"],
    ["Rows 2–5", "no-dash"],
    ["Type “SUM” here", "no-curly-quotes"],
    ["It’s fine", "no-curly-quotes"],
    ["Wait…", "no-ellipsis"],
    ["Well done \u{1F389}", "no-emoji"],
    ["Correct!", "no-exclamation"],
    ["Pro tip: use SUM.", "banned-phrase"],
    ["Here's the catch.", "banned-phrase"],
    ["It is not just a grid, it is a course.", "banned-phrase"],
    ["Unlock your potential.", "banned-phrase"],
    ["Oops, try again.", "banned-phrase"],
    ["Incorrect.", "banned-phrase"],
  ])("flags %j as %s", (text, rule) => {
    expect(rules(text)).toContain(rule);
  });

  it("allows the copyright sign, which is not an emoji", () => {
    expect(lintText("© 2026 Formula Practice")).toEqual([]);
  });

  it("matches banned words on word boundaries only", () => {
    expect(rules("The journal lists sales.")).toEqual([]);
  });

  it("flags a sentence of 30 words or more", () => {
    const sentence = `${Array.from({ length: 30 }, () => "word").join(" ")}.`;
    expect(rules(sentence)).toContain("sentence-length");
    expect(rules(`${Array.from({ length: 29 }, () => "word").join(" ")}.`)).toEqual([]);
  });

  it("flags a paragraph of 70 words or more", () => {
    const sentence = `${Array.from({ length: 10 }, () => "word").join(" ")}. `;
    expect(rules(sentence.repeat(7))).toContain("paragraph-length");
    expect(rules(sentence.repeat(6))).toEqual([]);
  });

  it("skips code spans in backticks", () => {
    expect(lintText("Type `=Sheet1!A1` in the bar.")).toEqual([]);
  });
});

describe("extractHtmlText", () => {
  it("splits blocks, decodes entities and keeps attribute text", () => {
    const html = `<html><head><title>Sum &amp; count</title>
      <meta name="description" content="Short &mdash; exercises"></head>
      <body><p>First <b>para</b>.</p><ul><li>One</li><li>Two</li></ul>
      <img alt="A grid"></body></html>`;
    expect(extractHtmlText(html)).toEqual([
      "Sum & count",
      "Short — exercises",
      "First para.",
      "One",
      "Two",
      "A grid",
    ]);
  });

  it("skips code, scripts, styles and elements marked data-copy=off", () => {
    const html = `<p>Type <code>=A1!</code> now.</p><script>alert("x!")</script>
      <style>a::after{content:"—"}</style>
      <table data-copy="off"><tr><td>Total!</td></tr><tr><td><table><tr><td>x</td></tr></table></td></tr></table>
      <p>After.</p>`;
    expect(extractHtmlText(html)).toEqual(["Type now.", "After."]);
  });
});

describe("lintHtml and lintYamlStrings", () => {
  it("reports the location of each issue", () => {
    expect(lintHtml("<p>Done!</p>", "dist/index.html")[0]?.where).toBe("dist/index.html");
  });

  it("lints prose fields and skips formula and code fields", () => {
    const issues = lintYamlStrings(
      {
        title: "Totals — March",
        notes: { syntax: "SUM(number1, [number2], …)" },
        screens: [
          {
            answer: "=A1!",
            accept: ["=B1!"],
            reject: [{ formula: "=C1!", rule: "syntax" }],
            hints: { nudge: "Go!" },
            misses: { syntax: "Close it!" },
          },
        ],
      },
      "x.yaml",
    );
    expect(issues.map((i) => i.where)).toEqual([
      "x.yaml: title",
      "x.yaml: screens.0.hints.nudge",
      "x.yaml: screens.0.misses.syntax",
    ]);
  });
});
