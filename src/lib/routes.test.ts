import { describe, expect, it } from "vitest";
import { ACCOUNT_PATHS, hiddenFromSearch, PRIVATE_PATHS, routesFromPageFiles } from "./routes.ts";

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

  it("shows the public account pages once accounts open, never the private ones", () => {
    for (const path of ["/login/", "/register/", "/forgot-password/"]) {
      expect(hiddenFromSearch(path, true), path).toBe(false);
    }
    for (const path of PRIVATE_PATHS) expect(hiddenFromSearch(path, true), path).toBe(true);
  });

  it("always hides certificate pages", () => {
    expect(hiddenFromSearch("/certificates/abcdefghijklmnopqrstuv/", false)).toBe(true);
    expect(hiddenFromSearch("/certificates/abcdefghijklmnopqrstuv/", true)).toBe(true);
  });

  it("never hides other pages, including PRO and pages that only start alike", () => {
    for (const path of ["/", "/pro/", "/exercises/", "/login-help/", "/accounts/"]) {
      expect(hiddenFromSearch(path, false), path).toBe(false);
    }
  });
});
