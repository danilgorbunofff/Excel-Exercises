import { describe, expect, it } from "vitest";
import { ACCOUNT_PATHS, hiddenFromSearch, routesFromPageFiles } from "./routes.ts";

describe("routesFromPageFiles", () => {
  it("maps index files to directory routes and drops 404 and dynamic pages", () => {
    expect(
      routesFromPageFiles([
        "./index.astro",
        "./404.astro",
        "./exercises/index.astro",
        "./exercises/[slug].astro",
        "./pricing.astro",
      ]),
    ).toEqual(["/", "/exercises/", "/pricing/"]);
  });
});

describe("hiddenFromSearch", () => {
  it("hides every account page while accounts are closed", () => {
    for (const path of ACCOUNT_PATHS) expect(hiddenFromSearch(path, false), path).toBe(true);
    expect(ACCOUNT_PATHS).toEqual([
      "/login/",
      "/register/",
      "/account/",
      "/profile/",
      "/forgot-password/",
      "/reset-password/",
      "/verify/",
      "/subscribe/",
    ]);
  });

  it("shows account pages once accounts open", () => {
    expect(hiddenFromSearch("/login/", true)).toBe(false);
  });

  it("never hides other pages, including PRO and pages that only start alike", () => {
    for (const path of ["/", "/pro/", "/exercises/", "/login-help/", "/accounts/"]) {
      expect(hiddenFromSearch(path, false), path).toBe(false);
    }
  });
});
