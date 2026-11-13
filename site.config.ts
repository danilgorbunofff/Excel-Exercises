// Why this exists: the one place for owner facts and configured numbers.
// Pages read these values and never type them in. Every TODO(owner) value is a
// placeholder until the owner supplies it.

export const siteConfig = {
  /** The site name. */
  name: "Excel Exercises",
  /** The production origin, used for canonical URLs and the sitemap. */
  url: "https://excelexercises.online",
  /** Language of the pages. */
  lang: "en",
  /** TODO(owner): the contact email address shown in the footer of every page. */
  contactEmail: null as string | null,
  /** The web host, named on the privacy page with its own privacy notice. */
  host: { name: "Vercel", privacyUrl: "https://vercel.com/legal/privacy-policy" } as {
    name: string;
    privacyUrl: string;
  } | null,
  /** How many exercises, counted in track order, are free. null means all are free. */
  freeCount: null as number | null,
  /**
   * Accounts and the PRO waitlist need a server, which comes in a later phase.
   * While this is false, the Log in, Sign up and PRO forms are shown but
   * disabled, with a note that progress stays in this browser.
   */
  accountsOpen: true,
} as const;
