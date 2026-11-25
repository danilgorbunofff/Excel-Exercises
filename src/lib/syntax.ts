// Why this exists: the function index shows a syntax line the way Excel's own
// argument tip does, with the required arguments plain and the optional ones
// muted. This splits "=IF(test, yes, [no])" into a name and its arguments.
export type SyntaxPart = { text: string; optional: boolean };

/** Split a syntax line into the function name and its arguments. */
export function syntaxParts(syntax: string): { name: string; args: SyntaxPart[] } {
  const match = /^=?(\w+)\((.*)\)$/u.exec(syntax.trim());
  if (!match) return { name: syntax, args: [] };
  const args: SyntaxPart[] = [];
  let depth = 0;
  let current = "";
  const push = () => {
    const text = current.trim();
    if (text) args.push({ text, optional: text.startsWith("[") || text === "..." });
    current = "";
  };
  for (const ch of match[2] ?? "") {
    if (ch === "[") depth += 1;
    if (ch === "]") depth -= 1;
    if (ch === "," && depth === 0) push();
    else current += ch;
  }
  push();
  return { name: match[1] ?? syntax, args };
}

const esc = (t: string) => t.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/** The same line as HTML: name in <b>, required arguments in <span class="r">, optional in <span class="o">. */
export function syntaxHtml(syntax: string): string {
  const { name, args } = syntaxParts(syntax);
  const list = args
    .map((a) => `<span class="${a.optional ? "o" : "r"}">${esc(a.text)}</span>`)
    .join(", ");
  return `<b>=${esc(name)}</b>(${list})`;
}
