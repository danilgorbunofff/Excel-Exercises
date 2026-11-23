// Why this exists: the one list of sections, so the header panels, the phone
// menu, the Practice tabs, the home page and the footer use the same names,
// addresses and descriptions.

import type { IconName } from "../components/Icon.astro";

export interface NavItem {
  label: string;
  /** Shown beside the name in the header panels. */
  icon: IconName;
  href: string;
  /** One plain line saying what the page is for, shown in the header panels. */
  description: string;
}

/** Ways to practise. The Practice tabs and the Practice header panel. */
export const PRACTICE_NAV: readonly NavItem[] = [
  {
    label: "Exercises",
    icon: "grid",
    href: "/exercises/",
    description: "Every exercise, with filters for level, function and track.",
  },
  {
    label: "Function practice",
    icon: "bolt",
    href: "/exercises/drills/",
    description: "Short tasks for one function or many. 10 free a day with an account.",
  },
  {
    label: "Learning tracks",
    icon: "route",
    href: "/exercises/tracks/",
    description: "Exercises in teaching order. Start here if formulas are new to you.",
  },
  {
    label: "Daily exercise",
    icon: "calendar",
    href: "/daily/",
    description: "One free exercise a day, the same for everyone, with your streak.",
  },
  {
    label: "Mock assessments",
    icon: "clock",
    href: "/mock-assessments/",
    description: "Timed sets of tasks like an employer's test, marked at the end.",
  },
  {
    label: "Progress",
    icon: "chart",
    href: "/progress/",
    description: "What you have solved and which exercises are due for review.",
  },
];

/** Pages to look things up in, shown in the Learn header panel. */
export const LEARN_NAV: readonly NavItem[] = [
  {
    label: "Functions",
    icon: "sigma",
    href: "/functions/",
    description: "Each Excel function with its syntax and the exercises that use it.",
  },
  {
    label: "Articles",
    icon: "book",
    href: "/articles/",
    description: "Short articles on references, lookups and errors.",
  },
  {
    label: "Keyboard shortcuts",
    icon: "keyboard",
    href: "/excel-shortcuts/",
    description: "Excel shortcuts for Windows and Mac, grouped by task.",
  },
];

export const NAV_GROUPS = [
  { id: "practice", label: "Practice", items: PRACTICE_NAV },
  { id: "learn", label: "Learn", items: LEARN_NAV },
] as const;

export const PRICING_NAV = { label: "Pricing", href: "/pricing/" } as const;

/** The account links: signed out, then signed in. */
export const ACCOUNT_NAV = {
  login: { label: "Log in", href: "/login/" },
  register: { label: "Sign up", href: "/register/" },
  profile: { label: "Overview", href: "/account/" },
  account: { label: "Account", href: "/account/" },
} as const;

/** The pages of the signed-in account area, in menu order. The key names each page. */
export const ACCOUNT_AREA = [
  { key: "overview", label: "Overview", icon: "grid", href: "/account/" },
  { key: "progress", label: "Progress", icon: "chart", href: "/account/progress/" },
  { key: "daily", label: "Daily exercise", icon: "calendar", href: "/account/daily/" },
  { key: "certificates", label: "Certificates", icon: "file", href: "/account/certificates/" },
  { key: "billing", label: "Plan and billing", icon: "briefcase", href: "/account/billing/" },
  { key: "settings", label: "Account settings", icon: "user", href: "/account/settings/" },
] as const satisfies readonly { key: string; label: string; icon: NavItem["icon"]; href: string }[];
export type AccountPage = (typeof ACCOUNT_AREA)[number]["key"];

/** The signed-in account menu. Log out is a form, added where the menu is drawn. */
export const YOU_NAV = ACCOUNT_AREA.filter((p) =>
  ["overview", "certificates", "settings"].includes(p.key),
).map(({ label, href }) => ({ label, href }));

export const SUPPORT_NAV = [
  PRICING_NAV,
  { label: "Terms", href: "/terms/" },
  { label: "Privacy", href: "/privacy/" },
] as const;

/**
 * The item a page belongs to: the longest href the path starts with. Items
 * that point at a place inside a page (a # link) never match, so the track
 * pages count as Learning tracks.
 */
export function currentHref(items: readonly { href: string }[], path: string): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    if (href.includes("#") || !path.startsWith(href)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}
