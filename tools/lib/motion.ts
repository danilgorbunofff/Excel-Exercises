// Why this exists: the brief requires every animation to sit inside
// @media (prefers-reduced-motion: no-preference). This scans built CSS and
// reports any motion declared outside that guard.

export interface MotionFinding {
  declaration: string;
  context: string;
}

const GUARD = /@media[^{]*prefers-reduced-motion\s*:\s*no-preference/iu;
const MOTION_PROPERTY = /^(?:transition|transition-[a-z-]+|animation|animation-[a-z-]+)$/u;

function isMotion(declaration: string): boolean {
  const colon = declaration.indexOf(":");
  if (colon < 1) return false;
  const property = declaration.slice(0, colon).trim().toLowerCase();
  const value = declaration
    .slice(colon + 1)
    .trim()
    .toLowerCase()
    .replace(/\s*!important$/u, "");
  if (property === "scroll-behavior") return value === "smooth";
  if (!MOTION_PROPERTY.test(property)) return false;
  return !/^(?:none|0s?|0ms|initial|unset)$/u.test(value);
}

/** Returns motion declarations that are not inside the reduced-motion guard. */
export function findUnguardedMotion(css: string): MotionFinding[] {
  const findings: MotionFinding[] = [];
  const stack: string[] = [];
  let text = "";
  const check = () => {
    const declaration = text.trim();
    text = "";
    if (!declaration || stack.length === 0) return;
    if (stack.some((p) => /^@keyframes/iu.test(p) || GUARD.test(p))) return;
    if (isMotion(declaration)) findings.push({ declaration, context: stack.join(" > ") });
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) j += css[j] === "\\" ? 2 : 1;
      text += css.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === "{") {
      stack.push(text.trim());
      text = "";
    } else if (ch === "}") {
      check();
      stack.pop();
    } else if (ch === ";") {
      check();
    } else {
      text += ch;
    }
  }
  return findings;
}
