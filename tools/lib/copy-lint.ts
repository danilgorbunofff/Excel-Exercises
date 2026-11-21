// Why this exists: enforces the copy rules on every word a visitor can read,
// in content files and in the built HTML, so style does not drift by hand.

export interface CopyIssue {
  rule: string;
  message: string;
  where: string;
  text: string;
}

const MAX_SENTENCE_WORDS = 29;
const MAX_PARAGRAPH_WORDS = 69;

const CHAR_RULES: { rule: string; pattern: RegExp; message: string }[] = [
  {
    rule: "no-dash",
    pattern: /[‒-―]/u,
    message: "Use a full stop, comma or colon, not an em or en dash.",
  },
  { rule: "no-curly-quotes", pattern: /[‘-‟]/u, message: "Use straight quotes and apostrophes." },
  { rule: "no-ellipsis", pattern: /…/u, message: "Do not use the ellipsis character." },
  // Extended_Pictographic includes the copyright, registered and trade mark signs, which are fine.
  {
    rule: "no-emoji",
    pattern: /(?![©®™])\p{Extended_Pictographic}/u,
    message: "Do not use emoji.",
  },
  { rule: "no-exclamation", pattern: /!/u, message: "Do not use exclamation marks." },
];

/** Marketing words, filler and verdicts that say nothing. Matched as whole words, any case. */
export const BANNED_PHRASES = [
  "here's the catch",
  "here is the catch",
  "pro tip",
  "not just",
  "seamless",
  "seamlessly",
  "unlock",
  "unleash",
  "supercharge",
  "empower",
  "elevate",
  "revolutionize",
  "revolutionise",
  "game-changer",
  "game changer",
  "cutting-edge",
  "world-class",
  "best-in-class",
  "next-level",
  "level up",
  "effortless",
  "effortlessly",
  "leverage",
  "robust",
  "delve",
  "journey",
  "skyrocket",
  "in today's",
  "oops",
  "whoops",
  "incorrect",
  "awesome",
  "amazing",
  // Machine-writing tells, see docs/voice.md. "landscape" and "navigate" stay out: both are Excel terms.
  "crucial",
  "pivotal",
  "harness",
  "realm",
  "tapestry",
  "testament",
  "vibrant",
  "comprehensive",
  "powerful",
  "game-changing",
  "whether you're",
  "next level",
  "streamline",
  "foster",
  "showcase",
  "intricate",
  "meticulous",
  "meticulously",
  "furthermore",
  "moreover",
  "in conclusion",
  "dive into",
  "let's",
  "plays a vital",
  "plays a key",
  "great job",
  "basically",
  "simply",
  "note that",
  "in order to",
  "a variety of",
  "it's important to",
  "it is important to",
] as const;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BANNED = new RegExp(
  `(?<![\\w-])(?:${BANNED_PHRASES.map(escapeRegExp).join("|")})(?![\\w-])`,
  "iu",
);

const countWords = (s: string) => s.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const excerpt = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}...` : s);

/** Lints one block of visible text. Code in backticks is skipped. */
export function lintText(raw: string, where = ""): CopyIssue[] {
  const text = raw
    .replace(/`[^`]*`/gu, "code")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) return [];
  const issues: CopyIssue[] = [];
  const add = (rule: string, message: string, t = text) =>
    issues.push({ rule, message, where, text: excerpt(t) });

  for (const { rule, pattern, message } of CHAR_RULES) {
    if (pattern.test(text)) add(rule, message);
  }
  const banned = BANNED.exec(text);
  if (banned) add("banned-phrase", `Do not use "${banned[0]}".`);

  for (const sentence of text.split(/(?<=[.?!])\s+/u)) {
    const n = countWords(sentence);
    if (n > MAX_SENTENCE_WORDS)
      add("sentence-length", `Sentence has ${n} words. Keep it under 30.`, sentence);
  }
  const words = countWords(text);
  if (words > MAX_PARAGRAPH_WORDS)
    add("paragraph-length", `Paragraph has ${words} words. Keep it under 70.`);
  return issues;
}

const SKIP_ELEMENTS = new Set([
  "script",
  "style",
  "code",
  "kbd",
  "samp",
  "pre",
  "svg",
  "template",
  "math",
]);
const VOID_ELEMENTS = new Set(
  "area base br col embed hr img input link meta source track wbr".split(" "),
);
const BLOCK_ELEMENTS = new Set(
  (
    "html head body title p li ul ol dl dt dd h1 h2 h3 h4 h5 h6 table thead tbody tfoot tr td th " +
    "caption figure figcaption blockquote div section header footer main nav article aside label " +
    "button summary details option select textarea legend fieldset form output br hr dialog"
  ).split(" "),
);
const TEXT_ATTRIBUTES = new Set(["alt", "title", "aria-label", "placeholder"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attributes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gu)) {
    const name = m[1];
    if (name) out.set(name.toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? ""));
  }
  return out;
}

/** Returns the visible text of an HTML page as blocks, in document order. */
export function extractHtmlText(html: string): string[] {
  const blocks: string[] = [];
  let buffer = "";
  let skipTag = "";
  let skipDepth = 0;
  const flush = () => {
    const t = decodeEntities(buffer).replace(/\s+/gu, " ").trim();
    if (t) blocks.push(t);
    buffer = "";
  };
  const token =
    /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+)/giu;
  for (const m of html.matchAll(token)) {
    const [, closing, rawName, attrSource, text] = m;
    if (text !== undefined) {
      if (skipDepth === 0) buffer += text;
      continue;
    }
    if (!rawName) continue;
    const name = rawName.toLowerCase();
    const isVoid = VOID_ELEMENTS.has(name) || (attrSource ?? "").trimEnd().endsWith("/");
    if (skipDepth > 0) {
      if (name === skipTag && !isVoid) skipDepth += closing ? -1 : 1;
      continue;
    }
    if (closing) {
      if (BLOCK_ELEMENTS.has(name)) flush();
      continue;
    }
    const attrs = attributes(attrSource ?? "");
    if (!isVoid && (SKIP_ELEMENTS.has(name) || attrs.get("data-copy") === "off")) {
      skipTag = name;
      skipDepth = 1;
      continue;
    }
    if (BLOCK_ELEMENTS.has(name)) flush();
    if (name === "meta") {
      const key = attrs.get("name") ?? attrs.get("property") ?? "";
      if (/^(description|og:description|og:title|twitter:)/u.test(key)) {
        const content = attrs.get("content");
        if (content) blocks.push(content);
      }
      continue;
    }
    for (const [key, value] of attrs) {
      if (TEXT_ATTRIBUTES.has(key) && value.trim()) blocks.push(value.trim());
    }
  }
  flush();
  return blocks;
}

export function lintHtml(html: string, where: string): CopyIssue[] {
  return extractHtmlText(html).flatMap((block) => lintText(block, where));
}

/** Keys whose values are formulas, code, data or identifiers rather than prose. */
const NON_PROSE_KEYS = new Set([
  "accept",
  "answer",
  "formula",
  "rows",
  "expected",
  "variants",
  "answerCell",
  "id",
  "slug",
  "topic",
  "updated",
  "checkedInExcel",
  "requiredFunctions",
  "forbiddenFunctions",
  "level",
  "order",
]);

/** Lints every prose string in a parsed content file. */
export function lintYamlStrings(data: unknown, file: string, path: string[] = []): CopyIssue[] {
  const key = path.at(-1);
  if (key !== undefined && NON_PROSE_KEYS.has(key)) return [];
  // "rule" is prose inside hints and a rule name inside reject fixtures.
  if (key === "rule" && path.at(-2) !== "hints") return [];
  // "syntax" is code inside notes and prose inside misses.
  if (key === "syntax" && path.at(-2) !== "misses") return [];
  if (typeof data === "string") return lintText(data, `${file}: ${path.join(".")}`);
  if (Array.isArray(data))
    return data.flatMap((v, i) => lintYamlStrings(v, file, [...path, String(i)]));
  if (data && typeof data === "object") {
    return Object.entries(data).flatMap(([k, v]) => lintYamlStrings(v, file, [...path, k]));
  }
  return [];
}
