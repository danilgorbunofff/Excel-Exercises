// Why this exists: the one list of sections, so the header, the menu and the
// footer use the same names and addresses.
export const MAIN_NAV = [
  { label: "Exercises", href: "/exercises/" },
  { label: "Functions", href: "/functions/" },
  { label: "Articles", href: "/articles/" },
] as const;

/** The account links: signed out, then signed in. */
export const ACCOUNT_NAV = {
  login: { label: "Log in", href: "/login/" },
  register: { label: "Sign up", href: "/register/" },
  profile: { label: "Profile", href: "/profile/" },
  account: { label: "Account", href: "/account/" },
} as const;

export const FOOTER_NAV = {
  learn: [
    { label: "Exercises", href: "/exercises/" },
    { label: "Learning tracks", href: "/exercises/tracks/" },
    { label: "Functions", href: "/functions/" },
    { label: "Articles", href: "/articles/" },
    { label: "Mock assessments", href: "/mock-assessments/" },
    { label: "Formula explainer", href: "/formula-explainer/" },
    { label: "Keyboard shortcuts", href: "/excel-shortcuts/" },
    { label: "Resources", href: "/resources/" },
    { label: "Progress", href: "/progress/" },
  ],
  support: [
    { label: "Pricing", href: "/pricing/" },
    { label: "Terms", href: "/terms/" },
    { label: "Privacy", href: "/privacy/" },
  ],
} as const;
